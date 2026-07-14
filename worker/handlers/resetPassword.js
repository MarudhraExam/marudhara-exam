import { json, errorResponse } from '../lib/response.js';
import { normalizeMobile, isNonEmptyString } from '../lib/validate.js';
import { queryDocumentsByField } from '../lib/firestore.js';
import { adminSetPassword } from '../lib/firebaseAuthAdmin.js';

/**
 * POST /api/reset-password
 * Body: { name: string, mobile: string, newPassword: string }
 *
 * Forgot Password, without SMS/email OTP: the student re-confirms their
 * registered Full Name + Mobile Number. Those are matched (case-
 * insensitive on name) against the `users` collection this Worker
 * already has service-account access to, and — only on a match — the
 * new password is set directly on that student's existing Firebase Auth
 * account via the Identity Toolkit Admin API. This mirrors how
 * /api/verify-payment already trusts this Worker's service-account
 * access rather than a client-supplied token, and keeps the password
 * itself stored only by Firebase Authentication, never as plain text.
 */
export async function handleResetPassword(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse(env, 400, 'INVALID_JSON', 'Request body must be valid JSON.');
  }

  const mobile = normalizeMobile(body.mobile);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!mobile) {
    return errorResponse(env, 400, 'INVALID_MOBILE', 'A valid 10-digit mobile number is required.');
  }
  if (!isNonEmptyString(name, 200)) {
    return errorResponse(env, 400, 'INVALID_NAME', 'Full name is required.');
  }
  if (newPassword.length < 6) {
    return errorResponse(env, 400, 'WEAK_PASSWORD', 'Password must be at least 6 characters.');
  }

  let matches;
  try {
    matches = await queryDocumentsByField(env, 'users', 'mobile', mobile);
  } catch (err) {
    console.error('reset-password: users lookup failed:', err.message);
    return errorResponse(env, 502, 'LOOKUP_FAILED', 'Unable to verify account right now. Please try again.');
  }

  const account = matches.find(u => (u.name || '').trim().toLowerCase() === name.toLowerCase());
  if (!account) {
    return errorResponse(env, 404, 'ACCOUNT_NOT_FOUND', 'No account found matching that name and mobile number.');
  }

  try {
    await adminSetPassword(env, account.id, newPassword);
  } catch (err) {
    console.error('reset-password: adminSetPassword failed:', err.message);
    return errorResponse(env, 502, 'RESET_FAILED', 'Unable to reset password right now. Please try again later.');
  }

  return json(env, { success: true });
}
