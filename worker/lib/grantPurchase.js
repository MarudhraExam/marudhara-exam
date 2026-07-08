import { getDocument, patchDocument, runDocumentTransaction } from './firestore.js';

/**
 * Shared "credit the purchase" logic used by both /api/verify-payment
 * (browser-driven) and /api/webhook (server-to-server fallback), so the
 * two paths can never diverge or double-credit an account.
 *
 * Idempotent: safe to call multiple times for the same orderId.
 *
 * @returns {Promise<{ status: 'credited'|'already_verified'|'not_found'|'mobile_mismatch', creditsRemaining?: number }>}
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

  if (order.status === 'verified' && order.verified === true) {
    const purchase = await getDocument(env, 'purchases', mobile);
    return {
      status: 'already_verified',
      mobile,
      creditsRemaining: purchase?.creditsRemaining ?? 0
    };
  }

  const packSize = typeof order.packSize === 'number' ? order.packSize : parseInt(env.PREMIUM_PACK_TEST_COUNT || '10', 10);

  await patchDocument(env, 'paymentOrders', orderId, {
    status: 'verified',
    verified: true,
    razorpayPaymentId: paymentId,
    verifiedAt: new Date()
  });

  const result = await runDocumentTransaction(env, 'purchases', mobile, current => {
    const now = new Date();
    if (!current) {
      return {
        fields: {
          mobile,
          hasPremiumAccess: true,
          creditsRemaining: packSize,
          unlockedTestIds: [],
          totalPacksPurchased: 1,
          lastOrderId: orderId,
          createdAt: now,
          updatedAt: now
        }
      };
    }
    return {
      fields: {
        ...current,
        hasPremiumAccess: true,
        creditsRemaining: (current.creditsRemaining || 0) + packSize,
        totalPacksPurchased: (current.totalPacksPurchased || 0) + 1,
        lastOrderId: orderId,
        updatedAt: now
      }
    };
  });

  return {
    status: 'credited',
    mobile,
    creditsRemaining: result.document.creditsRemaining
  };
}
