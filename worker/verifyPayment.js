import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isNonEmptyString } from '../lib/validate.js';
import { verifyPaymentSignature } from '../lib/razorpay.js';
import { patchDocument } from '../lib/firestore.js';
import { grantPurchaseForVerifiedOrder } from '../lib/grantPurchase.js';

/**
 * POST /api/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature, mobile }
 *
 * This is the primary place (the webhook in webhook.js is the fallback)
 * that grants premium credits. The signature is ALWAYS recomputed
 * server-side with RAZORPAY_KEY_SECRET — values supplied by the browser
 * are never trusted on their own, no matter what Razorpay Checkout
 * reported client-side as "success".
 */
export async function handleVerifyPayment(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const orderId = body.razorpay_order_id;
  const paymentId = body.razorpay_payment_id;
  const signature = body.razorpay_signature;
  const mobile = normalizeMobile(body.mobile);

  if (!isNonEmptyString(orderId) || !isNonEmptyString(paymentId) || !isNonEmptyString(signature)) {
    return errorResponse(env, 400, 'MISSING_FIELDS', 'razorpay_order_id, razorpay_payment_id and razorpay_signature are required.');
  }
  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number is required.');
  }

  // 1. Cryptographic verification — never trust the client's claim of success.
  let signatureValid;
  try {
    signatureValid = await verifyPaymentSignature(env, { orderId, paymentId, signature });
  } catch (err) {
    console.error('Signature verification error:', err.message);
    return errorResponse(env, 500, 'SIGNATURE_CHECK_FAILED', 'Unable to verify payment signature.');
  }

  if (!signatureValid) {
    try {
      await patchDocument(env, 'paymentOrders', orderId, { status: 'failed' });
    } catch (err) {
      console.error('Failed to mark order as failed:', err.message);
    }
    return errorResponse(env, 400, 'SIGNATURE_INVALID', 'Payment signature verification failed.');
  }

  // 2. Credit the account (idempotent, cross-checks mobile ownership of the order).
  let result;
  try {
    result = await grantPurchaseForVerifiedOrder(env, { orderId, paymentId, expectedMobile: mobile });
  } catch (err) {
    console.error('grantPurchaseForVerifiedOrder failed:', err.message);
    return errorResponse(env, 500, 'CREDIT_FAILED', 'Payment verified but unlocking credits failed. Please contact support or retry.');
  }

  if (result.status === 'not_found') {
    return errorResponse(env, 404, 'ORDER_NOT_FOUND', 'Payment order not found.');
  }
  if (result.status === 'mobile_mismatch') {
    return errorResponse(env, 403, 'MOBILE_MISMATCH', 'This payment order does not belong to the given mobile number.');
  }

  return json(env, {
    success: true,
    alreadyVerified: result.status === 'already_verified',
    hasPremiumAccess: true,
    creditsRemaining: result.creditsRemaining
  });
}
