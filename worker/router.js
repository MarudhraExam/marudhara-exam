import { errorResponse } from './lib/response.js';
import { handleCreateOrder } from './handlers/createOrder.js';
import { handleVerifyPayment } from './handlers/verifyPayment.js';
import { handleWebhook } from './handlers/webhook.js';
import { handleUnlockTest } from './handlers/unlockTest.js';
import { handlePurchaseStatus } from './handlers/purchaseStatus.js';

const routes = [
  { method: 'POST', path: '/api/create-order', handler: handleCreateOrder },
  { method: 'POST', path: '/api/verify-payment', handler: handleVerifyPayment },
  { method: 'POST', path: '/api/unlock-test', handler: handleUnlockTest },
  { method: 'GET', path: '/api/purchase-status', handler: handlePurchaseStatus },
  { method: 'POST', path: '/api/webhook', handler: handleWebhook }
];

export async function route(request, env, ctx) {
  const url = new URL(request.url);
  const match = routes.find(r => r.method === request.method && r.path === url.pathname);

  if (!match) {
    return errorResponse(env, 404, 'NOT_FOUND', `No route for ${request.method} ${url.pathname}`);
  }

  try {
    return await match.handler(request, env, ctx);
  } catch (err) {
    console.error(`Unhandled error in ${request.method} ${url.pathname}:`, err.stack || err.message);
    return errorResponse(env, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
}
