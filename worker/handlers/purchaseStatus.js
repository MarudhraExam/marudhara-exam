import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isValidDocId } from '../lib/validate.js';
import { getDocument } from '../lib/firestore.js';

/**
 * GET /api/purchase-status?mobile=9876543210&categoryId=rssb_cet
 *
 * Read-only status check used by mock-tests/confirm.html and
 * mock-tests/payment.html to decide whether a student already has paid
 * access to a CATEGORY (not an individual mock — every mock inside a
 * purchased category is unlocked together). Always returns a well-formed
 * object, even for a mobile number with no purchase history yet.
 *
 * If `categoryId` is omitted, returns the paid/unpaid map for every
 * category this mobile number has any record for.
 */
export async function handlePurchaseStatus(request, env) {
  const url = new URL(request.url);
  const mobile = normalizeMobile(url.searchParams.get('mobile'));
  const categoryId = url.searchParams.get('categoryId');

  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number query parameter ("mobile") is required.');
  }

  let access;
  try {
    access = await getDocument(env, 'userCategoryAccess', mobile);
  } catch (err) {
    console.error('purchase-status lookup failed:', err.message);
    return errorResponse(env, 502, 'LOOKUP_FAILED', 'Unable to fetch purchase status right now.');
  }

  const categories = (access && access.categories) || {};

  if (categoryId) {
    if (!isValidDocId(categoryId)) {
      return errorResponse(env, 400, 'INVALID_CATEGORY_ID', 'A valid categoryId is required.');
    }
    const paid = !!(categories[categoryId] && categories[categoryId].paid === true);
    return json(env, { success: true, mobile, categoryId, paid });
  }

  const paidByCategory = {};
  Object.keys(categories).forEach(id => {
    paidByCategory[id] = !!(categories[id] && categories[id].paid === true);
  });

  // Payment History (used by the new My Account page only — nothing
  // existing calls this endpoint without a categoryId today). Each paid
  // category's last order is looked up for amount/currency; the category
  // access boolean map above is completely unaffected either way.
  const purchasedEntries = Object.entries(categories).filter(([, entry]) => entry && entry.paid === true);
  let history = [];
  try {
    history = await Promise.all(purchasedEntries.map(async ([id, entry]) => {
      let amount = null;
      let currency = null;
      if (entry.lastOrderId) {
        try {
          const order = await getDocument(env, 'paymentOrders', entry.lastOrderId);
          if (order) {
            amount = typeof order.amount === 'number' ? order.amount : null;
            currency = order.currency || null;
          }
        } catch (err) {
          console.error('purchase-status: order lookup failed for', entry.lastOrderId, err.message);
        }
      }
      return {
        categoryId: id,
        paidAt: entry.paidAt || null,
        amount,
        currency,
        lastOrderId: entry.lastOrderId || null,
        lastPaymentId: entry.lastPaymentId || null
      };
    }));
  } catch (err) {
    console.error('purchase-status: history build failed:', err.message);
  }

  return json(env, { success: true, mobile, categories: paidByCategory, history });
}
