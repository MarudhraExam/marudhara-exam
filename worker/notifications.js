/**
 * notifications.js
 * ---------------------------------------------------------------------
 * Completely independent notification module for the Cloudflare Worker.
 *
 * - Does NOT import, call, or share any state with payment/Razorpay code,
 *   verifyPayment, the purchase flow, or download endpoints.
 * - Exposes exactly one route: POST /api/send-notification (unchanged).
 * - All other existing routes/behavior are untouched by this file.
 *
 * Wiring (the only change needed in your existing router — unchanged
 * from before):
 *
 *   import { handleSendNotification } from "./notifications.js";
 *
 *   if (url.pathname === "/api/send-notification" && request.method === "POST") {
 *     return handleSendNotification(request, env);
 *   }
 *
 * Required Worker environment variables:
 *   FIREBASE_PROJECT_ID    - Firebase project id
 *   FIREBASE_CLIENT_EMAIL   - service account client_email
 *   FIREBASE_PRIVATE_KEY    - service account private_key (PEM). If stored with
 *                        literal "\n" sequences (common when pasted into a
 *                        single-line secret), this module unescapes them
 *                        automatically.
 *   ADMIN_SECRET       - shared secret the caller must send as
 *                        `Authorization: Bearer <ADMIN_SECRET>`.
 *
 * Security & hardening added on top of the original implementation:
 *   - Bearer token auth (401 missing / 403 invalid).
 *   - Topic whitelist (400 on unknown topic).
 *   - Richer android payload (priority/channel_id/ttl/collapse_key).
 *   - Silent priority -> data-only message (no notification block).
 *   - Empty webpush/apns placeholders for future platforms.
 *   - Basic in-memory rate limiting: 10 requests/minute per bearer token,
 *     using only the Workers runtime (no KV/Durable Object/external
 *     dependency required). This is best-effort per-isolate limiting —
 *     fine for "basic" protection of a single admin-only endpoint. If
 *     stronger, globally-consistent limiting is needed later, this can
 *     be swapped for a KV- or Durable Object-backed counter without
 *     changing the public request/response contract.
 *   - Structured logging of topic/priority/title/timestamp/outcome only
 *     (never logs the Authorization token, ADMIN_SECRET, FCM private key,
 *     or the FCM access token).
 * ---------------------------------------------------------------------
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ALLOWED_PRIORITIES = ["High", "Normal", "Silent"];
const DEFAULT_TOPIC = "marudhara_updates";

// TASK 2: only these topics may be targeted by the endpoint.
const ALLOWED_TOPICS = [
  "marudhara_updates",
  "vacancies",
  "mocks",
  "results",
  "daily_sujas",
  "downloads",
  "notes",
  "announcements"
];

// TASK 3: Android delivery tuning.
const ANDROID_CHANNEL_ID = "marudhara_updates_channel";
const ANDROID_TTL = "604800s"; // 7 days
const ANDROID_COLLAPSE_KEY = "marudhara_updates";

// TASK 6: basic rate limiting — 10 requests / 60s per bearer token.
// Module-scope Map so it persists across requests handled by the same
// warm isolate. No external services or dependencies required.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitStore = new Map(); // token -> array of request timestamps (ms)

// ---------------------------------------------------------------------
// Low-level helpers (base64url, PEM parsing, JWT signing) — all scoped to
// this file only, nothing shared/exported that could collide with other
// modules in the Worker.
// ---------------------------------------------------------------------

function base64UrlEncode(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem) {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Exchanges the service account credentials for a short-lived OAuth2
 * access token via a self-signed JWT (RFC 7523). Uses only Web Crypto,
 * which is available natively in the Workers runtime — no extra deps.
 */
async function getAccessToken(env) {
  const clientEmail = env.FCM_CLIENT_EMAIL;
  const rawPrivateKey = env.FCM_PRIVATE_KEY;

  if (!clientEmail || !rawPrivateKey || !env.FCM_PROJECT_ID) {
    throw new Error(
      "FCM credentials are not configured. Set FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY as Worker environment variables."
    );
  }

  const privateKeyPem = rawPrivateKey.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: FCM_SCOPE,
    aud: FCM_TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const unsignedToken = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claimSet))}`;

  const key = await importPrivateKey(privateKeyPem);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const jwt = `${unsignedToken}.${base64UrlEncode(signatureBuffer)}`;

  const tokenResponse = await fetch(FCM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(
      `Failed to obtain FCM access token: ${tokenData.error_description || tokenData.error || tokenResponse.status}`
    );
  }

  return tokenData.access_token;
}

// ---------------------------------------------------------------------
// TASK 1: Bearer token authentication helpers.
// ---------------------------------------------------------------------

function getBearerToken(request) {
  const header = request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// ---------------------------------------------------------------------
// TASK 2: Topic whitelist helper.
// ---------------------------------------------------------------------

function isAllowedTopic(topic) {
  return ALLOWED_TOPICS.includes(topic);
}

// ---------------------------------------------------------------------
// TASK 6: Basic rate limiter — sliding 60s window, 10 requests per token.
// ---------------------------------------------------------------------

function isRateLimited(token) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const recentTimestamps = (rateLimitStore.get(token) || []).filter((t) => t > windowStart);

  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitStore.set(token, recentTimestamps);
    return true;
  }

  recentTimestamps.push(now);
  rateLimitStore.set(token, recentTimestamps);
  return false;
}

// ---------------------------------------------------------------------
// TASK 7: Logging helper. Only ever logs non-sensitive metadata — never
// the Authorization token, ADMIN_SECRET, FCM private key, or access token.
// ---------------------------------------------------------------------

function logNotificationEvent({ topic, priority, title, success, error }) {
  const entry = {
    event: "send-notification",
    topic,
    priority,
    title,
    timestamp: new Date().toISOString(),
    success
  };

  if (success) {
    console.log(JSON.stringify(entry));
  } else {
    console.error(JSON.stringify({ ...entry, error }));
  }
}

// ---------------------------------------------------------------------
// TASK 3 & 4: Builds the FCM `message` object — Android tuning, silent
// (data-only) vs. normal/high (notification + data), and empty webpush /
// apns placeholders reserved for future platform support.
// ---------------------------------------------------------------------

function mapAndroidPriority(priority) {
  return priority === "High" ? "HIGH" : "NORMAL";
}

function buildFcmMessage({ topic, title, message, priority }) {
  const isSilent = priority === "Silent";

  const androidConfig = {
    priority: mapAndroidPriority(priority),
    ttl: ANDROID_TTL,
    collapse_key: ANDROID_COLLAPSE_KEY
  };

  // channel_id only makes sense alongside a visible notification —
  // silent/data-only messages have no notification UI to route.
  if (!isSilent) {
    androidConfig.notification = { channel_id: ANDROID_CHANNEL_ID };
  }

  const fcmMessage = {
    topic,
    data: {
      type: "notification",
      timestamp: String(Date.now()),
      priority
    },
    android: androidConfig,
    // TASK 5: reserved for future platform support — intentionally empty.
    webpush: {},
    apns: {}
  };

  if (!isSilent) {
    fcmMessage.notification = {
      title: title || "",
      body: message || ""
    };
  }

  return fcmMessage;
}

// ---------------------------------------------------------------------
// Reusable notification helper — the single place that talks to FCM.
// Any future caller (this endpoint, a scheduled trigger, etc.) should
// go through this function instead of duplicating the send logic.
// ---------------------------------------------------------------------

/**
 * Sends one FCM HTTP v1 message to a topic.
 * @param {object} env - Worker environment (must contain FCM_* vars)
 * @param {object} params
 * @param {string} params.title
 * @param {string} params.message
 * @param {"High"|"Normal"|"Silent"} params.priority
 * @param {string} params.topic
 */
export async function sendFcmNotification(env, { title, message, priority, topic }) {
  const accessToken = await getAccessToken(env);

  const resolvedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : "Normal";

  const fcmMessage = {
    message: buildFcmMessage({ topic, title, message, priority: resolvedPriority })
  };

  const endpoint = `https://fcm.googleapis.com/v1/projects/${env.FCM_PROJECT_ID}/messages:send`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(fcmMessage)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`FCM send failed (${response.status}): ${result?.error?.message || "Unknown error"}`);
  }

  return result;
}

// ---------------------------------------------------------------------
// Route handler — POST /api/send-notification
// This is the only function the router needs to call. It owns its own
// request parsing, validation and error handling; it never touches
// payment/purchase/download code or state.
// ---------------------------------------------------------------------

export async function handleSendNotification(request, env) {
  let notifTopic;
  let notifPriority;
  let notifTitle;

  try {
    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
    }

    // TASK 1: require Authorization: Bearer <ADMIN_SECRET>.
    const token = getBearerToken(request);
    if (!token) {
      return jsonResponse({ success: false, error: "Authorization header is required" }, 401);
    }
    if (!env.ADMIN_SECRET || token !== env.ADMIN_SECRET) {
      return jsonResponse({ success: false, error: "Invalid or unauthorized token" }, 403);
    }

    // TASK 6: max 10 requests/minute per bearer token.
    if (isRateLimited(token)) {
      return jsonResponse({ success: false, error: "Rate limit exceeded. Try again later." }, 429);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ success: false, error: "Invalid JSON body" }, 400);
    }

    const { enabled, title, message, priority, topic } = body || {};

    // If enabled == false -> return success immediately, do nothing else.
    if (enabled === false) {
      return jsonResponse({ success: true });
    }

    if (enabled !== true) {
      return jsonResponse({ success: false, error: "'enabled' must be true or false" }, 400);
    }

    if (!title || typeof title !== "string") {
      return jsonResponse({ success: false, error: "'title' is required" }, 400);
    }

    if (!message || typeof message !== "string") {
      return jsonResponse({ success: false, error: "'message' is required" }, 400);
    }

    const resolvedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : "Normal";

    // TASK 2: reject any topic not on the whitelist.
    const resolvedTopic = typeof topic === "string" && topic.trim() ? topic.trim() : DEFAULT_TOPIC;
    if (!isAllowedTopic(resolvedTopic)) {
      return jsonResponse({ success: false, error: `Topic '${resolvedTopic}' is not allowed` }, 400);
    }

    notifTopic = resolvedTopic;
    notifPriority = resolvedPriority;
    notifTitle = title;

    await sendFcmNotification(env, {
      title,
      message,
      priority: resolvedPriority,
      topic: resolvedTopic
    });

    // TASK 7: log outcome — topic/priority/title/timestamp/success only.
    logNotificationEvent({ topic: notifTopic, priority: notifPriority, title: notifTitle, success: true });

    return jsonResponse({ success: true });
  } catch (error) {
    logNotificationEvent({
      topic: notifTopic,
      priority: notifPriority,
      title: notifTitle,
      success: false,
      error: error.message || "Failed to send notification"
    });
    return jsonResponse({ success: false, error: error.message || "Failed to send notification" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
