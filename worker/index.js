/**
 * Marudhara Exam — Payments Worker
 * ---------------------------------------------------------------------
 * Cloudflare Worker backend for Razorpay payments + Firestore-backed
 * CATEGORY-level premium mock test unlocking.
 *
 * Category-level Premium system: a student purchases access to an entire
 * mock test CATEGORY (e.g. "RSSB CET"), which unlocks every mock test
 * inside that category. Purchasing one category never unlocks another
 * (e.g. buying "RSSB CET" does not unlock "REET"). Individual mocks no
 * longer carry their own Free/Premium setting — that is controlled
 * entirely by the mock's category.
 *
 * Endpoints:
 *   POST /api/create-order      Create a Razorpay order for a category's offerPrice
 *   POST /api/verify-payment    Verify a Checkout payment (HMAC SHA-256) and unlock the category
 *   GET  /api/purchase-status   Read-only category purchase status for a mobile number
 *   POST /api/webhook           Razorpay server-to-server webhook (fallback safety net)
 *
 * This Worker never trusts client-supplied "payment succeeded" claims —
 * every grant of access is backed by a server-side HMAC signature check
 * against RAZORPAY_KEY_SECRET and an atomic Firestore transaction.
 */

import { route } from './router.js';
import { handlePreflight, corsHeaders } from './lib/cors.js';
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
