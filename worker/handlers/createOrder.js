import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile } from '../lib/validate.js';
import { createRazorpayOrder } from '../lib/razorpay.js';
import { getDocument, setDocument } from '../lib/firestore.js';

/**
 * POST /api/create-order
 * Body: { mobile: string }
 *
 * Creates a Razorpay order for the premium pack and records it in
 * `paymentOrders/{razorpayOrderId}` with status "created". The actual
 * grant of access happens later in /api/verify-payment, never here.
 */
export async function handleCreateOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const mobile = normalizeMobile(body.mobile);
  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number is required.');
  }

  // Pull pricing from Firestore so it can be changed from the admin panel
  // without redeploying the Worker. Falls back to safe defaults.
  let amountPaise = parseInt(env.PREMIUM_PACK_AMOUNT_PAISE || '4900', 10);
  let packSize = parseInt(env.PREMIUM_PACK_TEST_COUNT || '10', 10);
  try {
    const pricing = await getDocument(env, 'pricingConfig', 'premiumPack');
    if (pricing && pricing.active !== false) {
      if (typeof pricing.amountPaise === 'number') amountPaise = pricing.amountPaise;
      if (typeof pricing.testsIncluded === 'number') packSize = pricing.testsIncluded;
    }
  } catch (err) {
    // Non-fatal: proceed with env-based defaults if pricingConfig is unreachable.
    console.error('pricingConfig lookup failed, using defaults:', err.message);
  }

  const receipt = `pack_${mobile}_${Date.now()}`;

  let order;
  try {
    order = await createRazorpayOrder(env, {
      amountPaise,
      currency: 'INR',
      receipt,
      notes: { mobile, purpose: 'premium_mock_pack' }
    });
  } catch (err) {
    console.error('createRazorpayOrder failed:', err.message);
    return errorResponse(env, 502, 'RAZORPAY_ORDER_FAILED', 'Unable to create payment order. Please try again.');
  }

  try {
    await setDocument(env, 'paymentOrders', order.id, {
      mobile,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      status: 'created',
      amount: amountPaise,
      currency: 'INR',
      packSize,
      verified: false,
      createdAt: new Date(),
      verifiedAt: null
    });
  } catch (err) {
    console.error('Failed to persist paymentOrders doc:', err.message);
    return errorResponse(env, 502, 'ORDER_RECORD_FAILED', 'Unable to record payment order. Please try again.');
  }

  return json(env, {
    success: true,
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: env.RAZORPAY_KEY_ID,
    packSize
  });
}
