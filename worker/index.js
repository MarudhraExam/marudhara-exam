/**
 * Marudhara Exam — Payments Worker
 * ---------------------------------------------------------------------
 * Cloudflare Worker backend for Razorpay payments + Firestore-backed
 * premium mock test unlocking.
 *
 * Endpoints:
 *   POST /api/create-order      Create a Razorpay order for the premium pack
 *   POST /api/verify-payment    Verify a Checkout payment (HMAC SHA-256) and credit the account
 *   POST /api/unlock-test       Spend one credit to unlock a specific premium mock test
 *   GET  /api/purchase-status   Read-only purchase/unlock status for a mobile number
 *   POST /api/webhook           Razorpay server-to-server webhook (fallback safety net)
 *
 * This Worker never trusts client-supplied "payment succeeded" claims —
 * every grant of access is backed by a server-side HMAC signature check
 * against RAZORPAY_KEY_SECRET and an atomic Firestore transaction.
 */

import { route } from './router.js';
import { handlePreflight, corsHeaders } from './cors.js';
export default {
  async fetch(request, env, ctx) {
    const preflight = handlePreflight(request, env);
    if (preflight) return preflight;

    const response = await route(request, env, ctx);

    // Belt-and-braces: ensure CORS headers are present even if a handler
    // forgot to add them (json()/errorResponse() already do, but this
    // keeps the guarantee at the top level too).
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(env))) {
      if (!headers.has(key)) headers.set(key, value);
    }

    return new Response(response.body, { status: response.status, headers });
  }
};
