import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isValidDocId } from '../lib/validate.js';
import { createRazorpayOrder } from '../lib/razorpay.js';
import { getDocument, setDocument, queryDocuments } from '../lib/firestore.js';

/**
 * Safely converts a Firestore Timestamp, JavaScript Date, or ISO string to a JS Date.
 * Firestore Timestamps expose a .toDate() method; everything else is passed to new Date().
 */
function toJsDate(val) {
  if (val && typeof val.toDate === 'function') return val.toDate();
  if (val instanceof Date) return val;
  return new Date(val);
}

/**
 * Validates a coupon code and calculates the discount against the given originalAmount.
 *
 * Shared by both preview mode and normal payment mode so validation logic is never duplicated.
 *
 * Returns one of:
 *   { errorResponse: Response }          — a ready-to-return error Response on any failure
 *   { appliedCouponCode, discountAmount } — success; discountAmount is in rupees
 */
async function validateAndComputeCoupon(env, { couponCode, categoryId, mobile, originalAmount }) {
  // 1. Look up the coupon by its code field.
  let couponDocs;
  try {
    couponDocs = await queryDocuments(env, 'couponCodes', [
      { field: 'code', op: '==', value: couponCode }
    ]);
  } catch (err) {
    console.error('couponCodes lookup failed:', err.message);
    return { errorResponse: errorResponse(env, 502, 'COUPON_LOOKUP_FAILED', 'Unable to verify the coupon right now.') };
  }

  // 2. Coupon must exist — exactly one document expected.
  if (!couponDocs || couponDocs.length === 0) {
    return { errorResponse: errorResponse(env, 404, 'COUPON_NOT_FOUND', 'Coupon not found.') };
  }
  if (couponDocs.length > 1) {
    console.error(`Duplicate coupon documents found for code: ${couponCode}`);
    return { errorResponse: errorResponse(env, 500, 'COUPON_CONFIG_ERROR', 'Coupon configuration error. Please contact support.') };
  }

  const coupon = couponDocs[0];

  // 3. Coupon status must be enabled.
  if (coupon.status !== 'enabled') {
    return { errorResponse: errorResponse(env, 400, 'COUPON_DISABLED', 'This coupon is currently disabled.') };
  }

  // 4. Date range validation — handles Firestore Timestamp, Date, and ISO string.
  const now = new Date();
  const startDate = toJsDate(coupon.startDate);
  const endDate = toJsDate(coupon.endDate);

  if (now < startDate) {
    return { errorResponse: errorResponse(env, 400, 'COUPON_NOT_STARTED', 'This coupon is not yet active.') };
  }
  if (now > endDate) {
    return { errorResponse: errorResponse(env, 400, 'COUPON_EXPIRED', 'This coupon has expired.') };
  }

  // 5. Coupon must be valid for the requested category.
  // An empty categories array means the coupon applies to ALL categories.
  const couponCategories = Array.isArray(coupon.categories) ? coupon.categories : [];
  if (couponCategories.length > 0 && !couponCategories.includes(categoryId)) {
    return { errorResponse: errorResponse(env, 400, 'COUPON_NOT_VALID_FOR_CATEGORY', 'This coupon is not valid for the selected category.') };
  }

  // 6. One mobile number can use a coupon only once — checked against successfully
  // verified orders only. Users who created but never paid are not blocked.
  // Query by mobile+couponCode (two-field query), then filter verified in memory
  // to avoid requiring a three-field composite Firestore index.
  let usageDocs;
  try {
    usageDocs = await queryDocuments(env, 'paymentOrders', [
      { field: 'mobile', op: '==', value: mobile },
      { field: 'couponCode', op: '==', value: couponCode }
    ]);
  } catch (err) {
    console.error('paymentOrders coupon usage lookup failed:', err.message);
    return { errorResponse: errorResponse(env, 502, 'COUPON_USAGE_LOOKUP_FAILED', 'Unable to verify coupon usage right now.') };
  }

  const alreadyUsed = Array.isArray(usageDocs) && usageDocs.some(doc => doc.verified === true);
  if (alreadyUsed) {
    return { errorResponse: errorResponse(env, 400, 'COUPON_ALREADY_USED', 'You have already used this coupon.') };
  }

  // 7. Validate discount configuration and calculate discount amount (in rupees).
  const discountType = coupon.discountType;
  const discountValue = Number(coupon.discountValue);
  let discountAmount = 0;

  if (discountType === 'fixed') {
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      console.error(`Invalid fixed discountValue for coupon ${couponCode}: ${coupon.discountValue}`);
      return { errorResponse: errorResponse(env, 500, 'COUPON_CONFIG_ERROR', 'Coupon configuration error. Please contact support.') };
    }
    discountAmount = discountValue;
  } else if (discountType === 'percentage') {
    if (!Number.isFinite(discountValue) || discountValue <= 0 || discountValue > 100) {
      console.error(`Invalid percentage discountValue for coupon ${couponCode}: ${coupon.discountValue}`);
      return { errorResponse: errorResponse(env, 500, 'COUPON_CONFIG_ERROR', 'Coupon configuration error. Please contact support.') };
    }
    discountAmount = (originalAmount * discountValue) / 100;
  }

  // Ensure discount does not bring paidAmount below ₹1.
  discountAmount = Math.min(discountAmount, originalAmount - 1);
  discountAmount = Math.max(discountAmount, 0);

  return { appliedCouponCode: couponCode, discountAmount };
}

/**
 * POST /api/create-order
 * Body: { mobile: string, categoryId: string, couponCode?: string, preview?: boolean }
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
 *
 * If couponCode is provided, it is validated against the `couponCodes`
 * collection and the appropriate discount is applied before creating the
 * Razorpay order. The student never controls the final amount.
 *
 * If preview === true, the coupon is validated and amounts are calculated
 * but no Razorpay order is created and nothing is written to Firestore.
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
  const rawCouponCode = body.couponCode;
  const isPreview = body.preview === true;

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

  // originalAmount is always the category offerPrice (in rupees).
  const originalAmount = offerPrice;
  let discountAmount = 0;
  let appliedCouponCode = null;

  // Normalise coupon code — only when a non-empty couponCode is supplied.
  const couponCode = (typeof rawCouponCode === 'string' && rawCouponCode.trim() !== '')
    ? rawCouponCode.trim().toUpperCase()
    : null;

  // Validate and compute coupon discount using the shared helper.
  if (couponCode) {
    const couponResult = await validateAndComputeCoupon(env, { couponCode, categoryId, mobile, originalAmount });
    if (couponResult.errorResponse) return couponResult.errorResponse;
    discountAmount = couponResult.discountAmount;
    appliedCouponCode = couponResult.appliedCouponCode;
  }

  // paidAmount is what the student actually pays (in rupees).
  const paidAmount = originalAmount - discountAmount;

  // ---- Preview mode: return amounts only, no Razorpay call, no Firestore writes. ----
  if (isPreview) {
    return json(env, {
      success: true,
      preview: true,
      categoryId,
      couponCode: appliedCouponCode,
      originalAmount: Math.round(originalAmount * 100),
      discountAmount: Math.round(discountAmount * 100),
      paidAmount: Math.round(paidAmount * 100),
      currency: 'INR'
    });
  }

  // ---- Normal payment mode: create Razorpay order and persist paymentOrders doc. ----

  // Convert to paise (Razorpay's smallest unit).
  const amountPaise = Math.round(paidAmount * 100);
  const receipt = `cat_${mobile}_${Date.now()}`.slice(0, 40);

  let order;
  try {
    order = await createRazorpayOrder(env, {
      amountPaise,
      currency: 'INR',
      receipt,
      notes: {
        mobile,
        categoryId,
        purpose: 'category_unlock',
        couponCode: appliedCouponCode,
        originalAmount: Math.round(originalAmount * 100),
        discountAmount: Math.round(discountAmount * 100),
        paidAmount: amountPaise
      }
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
      verifiedAt: null,
      couponCode: appliedCouponCode,
      originalAmount: Math.round(originalAmount * 100),
      discountAmount: Math.round(discountAmount * 100),
      paidAmount: amountPaise
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
