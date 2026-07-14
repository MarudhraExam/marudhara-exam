/**
 * Exchanges a Firebase/GCP service account key for a short-lived OAuth2
 * access token, so this Worker can call the Firestore REST API with
 * proper read/write credentials (Firestore's public REST API otherwise
 * only allows access governed by security rules, which are written for
 * client SDK access — server-to-server calls should use a service account).
 *
 * The token is cached on the module scope for the lifetime of the isolate
 * to avoid re-signing a JWT on every request. It is refreshed a minute
 * before it actually expires.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore';
// Used only by the Forgot Password flow (worker/lib/firebaseAuthAdmin.js)
// to call the Firebase Identity Toolkit Admin API server-side.
export const IDENTITY_TOOLKIT_SCOPE = 'https://www.googleapis.com/auth/identitytoolkit';

const cachedTokens = {}; // scope -> { accessToken, expiresAt }

function base64UrlEncode(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importPrivateKey(pem) {
  const keyData = pemToArrayBuffer(pem);
  return crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function signJwt(env, scope) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: env.FIREBASE_CLIENT_EMAIL,
    scope,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600
  };

  const encoder = new TextEncoder();
  const encodedHeader = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const encodedClaimSet = base64UrlEncode(encoder.encode(JSON.stringify(claimSet)));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  // Cloudflare secrets can't store literal newlines cleanly in some flows,
  // so the private key is expected to be stored with \n escape sequences.
  const privateKeyPem = env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsignedToken)
  );

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

/**
 * Returns a valid Google OAuth2 access token, refreshing/caching as
 * needed. `scope` defaults to the Firestore scope every existing caller
 * already relies on; pass IDENTITY_TOOLKIT_SCOPE for the Forgot Password
 * Admin API calls instead. Each scope is cached independently.
 */
export async function getGoogleAccessToken(env, scope = FIRESTORE_SCOPE) {
  const nowMs = Date.now();
  const cached = cachedTokens[scope];
  if (cached && cached.expiresAt - 60_000 > nowMs) {
    return cached.accessToken;
  }

  const assertion = await signJwt(env, scope);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth token exchange failed: ${data?.error_description || res.statusText}`);
  }

  cachedTokens[scope] = {
    accessToken: data.access_token,
    expiresAt: nowMs + data.expires_in * 1000
  };
  return cachedTokens[scope].accessToken;
}
