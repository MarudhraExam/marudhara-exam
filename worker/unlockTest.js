import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isValidDocId } from '../lib/validate.js';
import { getDocument, runDocumentTransaction } from '../lib/firestore.js';

/**
 * POST /api/unlock-test
 * Body: { mobile: string, mockId: string }
 *
 * This is the only place that spends a premium credit. It is called by
 * the frontend right before a premium exam starts (from confirm.html).
 * It is intentionally NOT client-trusted: the frontend never decides on
 * its own whether a test is unlocked — this endpoint (backed by an atomic
 * Firestore transaction) is the single source of truth, so the same test
 * can be re-opened later without spending a second credit, and concurrent
 * requests can't double-spend the last credit.
 */
export async function handleUnlockTest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const mobile = normalizeMobile(body.mobile);
  const mockId = body.mockId;

  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number is required.');
  }
  if (!isValidDocId(mockId)) {
    return errorResponse(env, 400, 'INVALID_MOCK_ID', 'A valid mockId is required.');
  }

  // Cross-check against the actual mock test document: if it turns out to
  // be a free test, there is nothing to unlock/spend — allow immediately.
  let mockTest;
  try {
    mockTest = await getDocument(env, 'mockTests', mockId);
  } catch (err) {
    console.error('Failed to load mockTests doc:', err.message);
    return errorResponse(env, 502, 'MOCK_LOOKUP_FAILED', 'Unable to verify the mock test right now.');
  }

  if (!mockTest) {
    return errorResponse(env, 404, 'MOCK_NOT_FOUND', 'Mock test not found.');
  }

  const isFree = mockTest.isFree === true || String(mockTest.premium || '').toLowerCase() !== 'premium';
  if (isFree) {
    return json(env, { success: true, unlocked: true, freeTest: true });
  }

  // Premium test: consult/consume the purchases/{mobile} document atomically.
  let transactionResult;
  try {
    transactionResult = await runDocumentTransaction(env, 'purchases', mobile, current => {
      if (!current) {
        // No purchase record at all -> nothing to unlock with. Abort (no write).
        return null;
      }

      const unlockedTestIds = Array.isArray(current.unlockedTestIds) ? current.unlockedTestIds : [];
      if (unlockedTestIds.includes(mockId)) {
        // Already unlocked previously — no credit spend, no write needed.
        return null;
      }

      const creditsRemaining = current.creditsRemaining || 0;
      if (creditsRemaining <= 0) {
        // Out of credits — abort (no write); handled below via re-read.
        return null;
      }

      return {
        fields: {
          ...current,
          creditsRemaining: creditsRemaining - 1,
          unlockedTestIds: [...unlockedTestIds, mockId],
          updatedAt: new Date()
        }
      };
    });
  } catch (err) {
    console.error('unlock-test transaction failed:', err.message);
    return errorResponse(env, 500, 'UNLOCK_FAILED', 'Unable to unlock this test right now.');
  }

  const doc = transactionResult.document;

  if (!doc) {
    return errorResponse(env, 403, 'NO_PREMIUM_ACCESS', 'No premium pack found for this mobile number. Please purchase the premium pack first.');
  }

  const alreadyUnlocked = Array.isArray(doc.unlockedTestIds) && doc.unlockedTestIds.includes(mockId);

  if (!transactionResult.committed) {
    if (alreadyUnlocked) {
      return json(env, {
        success: true,
        unlocked: true,
        alreadyUnlocked: true,
        creditsRemaining: doc.creditsRemaining || 0
      });
    }
    // Not already unlocked and nothing was committed -> ran out of credits.
    return errorResponse(env, 403, 'NO_CREDITS_REMAINING', 'No premium credits remaining. Please purchase another pack.');
  }

  return json(env, {
    success: true,
    unlocked: true,
    alreadyUnlocked: false,
    creditsRemaining: doc.creditsRemaining
  });
}
