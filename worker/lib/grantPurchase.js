import { getDocument, patchDocument, runDocumentTransaction } from './firestore.js';

/**
 * Shared "grant category access" logic used by both /api/verify-payment
 * (browser-driven) and /api/webhook (server-to-server fallback), so the
 * two paths can never diverge or double-grant access.
 *
 * Category-level Premium system: a successful payment unlocks ONE category
 * (e.g. "RSSB CET") for the paying student's mobile number. Every mock test
 * inside that category becomes accessible; other categories are untouched.
 *
 * Idempotent: safe to call multiple times for the same orderId.
 *
 * @returns {Promise<{ status: 'credited'|'already_verified'|'not_found'|'mobile_mismatch', mobile?: string, categoryId?: string, paid?: boolean }>}
 */
export async function grantPurchaseForVerifiedOrder(env, { orderId, paymentId, expectedMobile = null }) {
  const order = await getDocument(env, 'paymentOrders', orderId);
  if (!order) {
    return { status: 'not_found' };
  }
  if (expectedMobile && order.mobile !== expectedMobile) {
    return { status: 'mobile_mismatch' };
  }

  const mobile = order.mobile;
  const categoryId = order.categoryId;

  if (order.status === 'verified' && order.verified === true) {
    const access = await getDocument(env, 'userCategoryAccess', mobile);
    const paid = !!(access && access.categories && access.categories[categoryId] && access.categories[categoryId].paid === true);
    return { status: 'already_verified', mobile, categoryId, paid };
  }

  await patchDocument(env, 'paymentOrders', orderId, {
    status: 'verified',
    verified: true,
    razorpayPaymentId: paymentId,
    verifiedAt: new Date()
  });

  // Store purchase per category: userCategoryAccess/{mobile}.categories.{categoryId}.paid
  const result = await runDocumentTransaction(env, 'userCategoryAccess', mobile, current => {
    const now = new Date();
    const categories = (current && current.categories) ? { ...current.categories } : {};

    const existing = categories[categoryId];
    if (existing && existing.paid === true) {
      // Already unlocked for this category — no-op (idempotent, no write).
      return null;
    }

    categories[categoryId] = {
      paid: true,
      paidAt: now,
      lastOrderId: orderId,
      lastPaymentId: paymentId
    };

    return {
      fields: {
        mobile,
        categories,
        updatedAt: now
      }
    };
  });

  const doc = result.document || { categories: { [categoryId]: { paid: true } } };
  const paid = !!(doc.categories && doc.categories[categoryId] && doc.categories[categoryId].paid === true);

  return { status: 'credited', mobile, categoryId, paid };
}
