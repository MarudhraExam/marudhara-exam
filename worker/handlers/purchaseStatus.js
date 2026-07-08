import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile } from '../lib/validate.js';
import { getDocument } from '../lib/firestore.js';

/**
 * GET /api/purchase-status?mobile=9876543210
 *
 * Read-only status check used by category.html / confirm.html / exam.html
 * to render lock state and to re-verify access before an exam is allowed
 * to actually start. Always returns a well-formed object, even for a
 * mobile number with no purchase history yet.
 */
export async function handlePurchaseStatus(request, env) {
  const url = new URL(request.url);
  const mobile = normalizeMobile(url.searchParams.get('mobile'));

  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number query parameter ("mobile") is required.');
  }

  let purchase;
  try {
    purchase = await getDocument(env, 'purchases', mobile);
  } catch (err) {
    console.error('purchase-status lookup failed:', err.message);
    return errorResponse(env, 502, 'LOOKUP_FAILED', 'Unable to fetch purchase status right now.');
  }

  return json(env, {
    success: true,
    mobile,
    hasPremiumAccess: purchase?.hasPremiumAccess ?? false,
    creditsRemaining: purchase?.creditsRemaining ?? 0,
    unlockedTestIds: purchase?.unlockedTestIds ?? [],
    totalPacksPurchased: purchase?.totalPacksPurchased ?? 0
  });
}
