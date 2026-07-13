import { errorResponse } from './lib/response.js';
import { handleCreateOrder } from './handlers/createOrder.js';
import { handleVerifyPayment } from './handlers/verifyPayment.js';
import { handleWebhook } from './handlers/webhook.js';
import { handlePurchaseStatus } from './handlers/purchaseStatus.js';
import { handleDownloadQuestionPaper } from './handlers/downloadQuestionPaper.js';

const routes = [
  { method: 'POST', path: '/api/create-order', handler: handleCreateOrder },
  { method: 'POST', path: '/api/verify-payment', handler: handleVerifyPayment },
  { method: 'GET', path: '/api/purchase-status', handler: handlePurchaseStatus },
  { method: 'POST', path: '/api/webhook', handler: handleWebhook },
  // Secure Question Paper PDF download: reads the mock's pdfLink server-side
  // only, watermarks it with the student's name/mobile, and streams it back.
  { method: 'GET', path: '/api/download-question-paper', handler: handleDownloadQuestionPaper }
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
