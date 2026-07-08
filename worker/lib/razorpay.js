/**
 * Razorpay REST API integration.
 *
 * All calls are authenticated with HTTP Basic Auth using
 * RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET, which live only in this Worker's
 * secret bindings and are never exposed to the browser.
 */

const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

function basicAuthHeader(keyId, keySecret) {
  const raw = `${keyId}:${keySecret}`;
  const encoded = btoa(raw);
  return `Basic ${encoded}`;
}

/**
 * Creates a Razorpay order.
 * @returns {Promise<{id: string, amount: number, currency: string, status: string}>}
 */
export async function createRazorpayOrder(env, { amountPaise, currency = 'INR', receipt, notes }) {
  const res = await fetch(`${RAZORPAY_API_BASE}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET)
    },
    body: JSON.stringify({
      amount: amountPaise,
      currency,
      receipt,
      notes,
      payment_capture: 1
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Razorpay order creation failed: ${data?.error?.description || res.statusText}`);
  }
  return data;
}

/** Converts an ArrayBuffer to a lowercase hex string. */
function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Computes HMAC-SHA256(message, secret) and returns lowercase hex digest. */
async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bufferToHex(signature);
}

/** Constant-time string comparison to avoid timing side-channels. */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verifies a Razorpay Checkout payment signature.
 * Formula per Razorpay docs: HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export async function verifyPaymentSignature(env, { orderId, paymentId, signature }) {
  const expected = await hmacSha256Hex(env.RAZORPAY_KEY_SECRET, `${orderId}|${paymentId}`);
  return timingSafeEqual(expected, signature);
}

/**
 * Verifies a Razorpay webhook signature.
 * Formula per Razorpay docs: HMAC_SHA256(rawRequestBody, webhook_secret)
 */
export async function verifyWebhookSignature(env, { rawBody, signature }) {
  const expected = await hmacSha256Hex(env.RAZORPAY_WEBHOOK_SECRET, rawBody);
  return timingSafeEqual(expected, signature);
}
