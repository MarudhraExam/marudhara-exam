import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isValidDocId } from '../lib/validate.js';
import { createRazorpayOrder } from '../lib/razorpay.js';
import { getDocument, setDocument } from '../lib/firestore.js';

/**
 * POST /api/create-order
 * Body: { mobile: string, categoryId: string }
 *
 * Category-level Premium system: a student purchases access to ONE
 * category (e.g. "RSSB CET"). This creates a Razorpay order for that
 * category's offerPrice and records it in `paymentOrders/{razorpayOrderId}`
 * with status "created". The actual grant of access happens later in
 * /api/verify-payment (or the webhook fallback), never here.
 *
 * Pricing always comes from the category document in Firestore
 * (`mockCategories/{categoryId}.offerPrice`) so that changing a category's
 * price in the admin panel automatically affects payment amount here —
 * no Worker redeploy required, and no per-mock pricing anywhere.
 */
export async function handleCreateOrder(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const mobile = normalizeMobile(body.mobile);
  const categoryId = body.categoryId;

  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number is required.');
  }
  if (!isValidDocId(categoryId)) {
    return errorResponse(env, 400, 'INVALID_CATEGORY_ID', 'A valid categoryId is required.');
  }

  let category;
  try {
    category = await getDocument(env, 'mockCategories', categoryId);
  } catch (err) {
    console.error('mockCategories lookup failed:', err.message);
    return errorResponse(env, 502, 'CATEGORY_LOOKUP_FAILED', 'Unable to verify the category right now.');
  }

  if (!category) {
    return errorResponse(env, 404, 'CATEGORY_NOT_FOUND', 'Category not found.');
  }
  if (category.isFree === true) {
    return errorResponse(env, 400, 'CATEGORY_IS_FREE', 'This category is free and does not require payment.');
  }

  const offerPrice = Number(category.offerPrice);
  if (!Number.isFinite(offerPrice) || offerPrice <= 0) {
    return errorResponse(env, 400, 'INVALID_CATEGORY_PRICE', 'This category does not have a valid offer price configured. Please contact support.');
  }

  // Payment amount must always use offerPrice, converted to paise (Razorpay's smallest unit).
  const amountPaise = Math.round(offerPrice * 100);
  const receipt = `cat_${mobile}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await createRazorpayOrder(env, {
      amountPaise,
      currency: 'INR',
      receipt,
      notes: { mobile, categoryId, purpose: 'category_unlock' }
    });
  } catch (err) {
    console.error('createRazorpayOrder failed:', err.message);
    return errorResponse(env, 502, 'RAZORPAY_ORDER_FAILED', 'Unable to create payment order. Please try again.');
  }

  try {
    await setDocument(env, 'paymentOrders', order.id, {
      mobile,
      categoryId,
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      status: 'created',
      amount: amountPaise,
      currency: 'INR',
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
    categoryId
  });
}
