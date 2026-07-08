import { json, errorResponse } from '../lib/response.js';
import { verifyWebhookSignature } from '../lib/razorpay.js';
import { grantPurchaseForVerifiedOrder } from '../lib/grantPurchase.js';

/**
 * POST /api/webhook
 *
 * Configure this URL in the Razorpay Dashboard (Settings -> Webhooks) for
 * at least the `payment.captured` event, with a webhook secret set as
 * RAZORPAY_WEBHOOK_SECRET.
 *
 * Purpose: a safety net. If the student's browser closes/crashes/loses
 * network right after a successful payment but before /api/verify-payment
 * completes, this webhook still lands and credits the account — so a
 * successful Razorpay payment can never result in a stuck "paid but not
 * unlocked" account without any recovery path. It is idempotent with
 * /api/verify-payment via the shared grantPurchaseForVerifiedOrder logic.
 */
export async function handleWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-razorpay-signature') || '';

  let signatureValid;
  try {
    signatureValid = await verifyWebhookSignature(env, { rawBody, signature });
  } catch (err) {
    console.error('Webhook signature verification error:', err.message);
    return errorResponse(env, 500, 'WEBHOOK_SIGNATURE_CHECK_FAILED', 'Unable to verify webhook signature.');
  }

  if (!signatureValid) {
    // Do not process unverified payloads. Respond 400 so Razorpay's
    // dashboard surfaces the misconfiguration rather than silently retrying forever.
    return errorResponse(env, 400, 'WEBHOOK_SIGNATURE_INVALID', 'Webhook signature verification failed.');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Webhook payload is not valid JSON.');
  }

  const event = payload.event;
  const relevantEvents = new Set(['payment.captured', 'order.paid']);

  if (!relevantEvents.has(event)) {
    // Acknowledge but ignore events we don't act on (e.g. payment.failed),
    // so Razorpay stops retrying delivery.
    return json(env, { success: true, ignored: true, event });
  }

  const paymentEntity = payload.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id;
  const paymentId = paymentEntity?.id;

  if (!orderId || !paymentId) {
    return errorResponse(env, 400, 'MISSING_ORDER_OR_PAYMENT_ID', 'Webhook payload missing order/payment id.');
  }

  try {
    const result = await grantPurchaseForVerifiedOrder(env, { orderId, paymentId });
    if (result.status === 'not_found') {
      // Order doc should have been created by /api/create-order; log for investigation.
      console.error(`Webhook received for unknown orderId=${orderId}`);
      return errorResponse(env, 404, 'ORDER_NOT_FOUND', 'Payment order not found.');
    }
    return json(env, {
      success: true,
      status: result.status,
      creditsRemaining: result.creditsRemaining
    });
  } catch (err) {
    console.error('Webhook grantPurchaseForVerifiedOrder failed:', err.message);
    // Return 500 so Razorpay retries delivery later.
    return errorResponse(env, 500, 'CREDIT_FAILED', 'Failed to process webhook payment credit.');
  }
}
