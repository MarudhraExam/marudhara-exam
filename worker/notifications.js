/**
 * notifications.js
 * ---------------------------------------------------------------------
 * Completely independent notification module for the Cloudflare Worker.
 *
 * - Does NOT import, call, or share any state with payment/Razorpay code,
 *   verifyPayment, the purchase flow, or download endpoints.
 * - Exposes exactly one new route: POST /api/send-notification
 * - All other existing routes/behavior are untouched by this file.
 *
 * Wiring (the only change needed in your existing router):
 *
 *   import { handleSendNotification } from "./notifications.js";
 *
 *   // inside your existing fetch handler / router, add ONE branch:
 *   if (url.pathname === "/api/send-notification" && request.method === "POST") {
 *     return handleSendNotification(request, env);
 *   }
 *
 * Required Worker environment variables (set via `wrangler secret put`):
 *   FCM_PROJECT_ID     - Firebase project id
 *   FCM_CLIENT_EMAIL   - service account client_email
 *   FCM_PRIVATE_KEY    - service account private_key (PEM). If stored with
 *                        literal "\n" sequences (common when pasted into a
 *                        single-line secret), this module unescapes them
 *                        automatically.
 * ---------------------------------------------------------------------
 */

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const FCM_TOKEN_URL = "https://oauth2.googleapis.com/token";
const ALLOWED_PRIORITIES = ["High", "Normal", "Silent"];
const DEFAULT_TOPIC = "marudhara_updates";

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

  const fcmMessage = {
    message: {
      topic,
      notification: {
        title: title || "",
        body: message || ""
      },
      data: {
        type: "notification",
        timestamp: String(Date.now()),
        priority: priority || "Normal"
      }
    }
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
  try {
    if (request.method !== "POST") {
      return jsonResponse({ success: false, error: "Method not allowed" }, 405);
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
    const resolvedTopic = typeof topic === "string" && topic.trim() ? topic.trim() : DEFAULT_TOPIC;

    await sendFcmNotification(env, {
      title,
      message,
      priority: resolvedPriority,
      topic: resolvedTopic
    });

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("send-notification error:", error);
    return jsonResponse({ success: false, error: error.message || "Failed to send notification" }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
