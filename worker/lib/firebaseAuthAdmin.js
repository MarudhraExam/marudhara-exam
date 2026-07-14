/**
 * Minimal Firebase Identity Toolkit Admin REST client.
 *
 * Used ONLY by the Forgot Password flow (worker/handlers/resetPassword.js)
 * to set a brand-new password directly on an existing Firebase Auth
 * account, without needing the student's old password or a mailed/texted
 * reset link (this project has no SMS/email delivery channel — OTP has
 * been removed entirely).
 *
 * Authenticated the same way as firestore.js — a Google service-account
 * OAuth2 access token (see googleAuth.js) — but scoped to the Identity
 * Toolkit Admin API instead of Firestore. This never runs in the browser
 * and is never reachable with a client-supplied token.
 *
 * One-time setup note: the service account behind FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY must have a role that includes Identity Toolkit
 * admin access (the default Firebase Admin SDK service account already
 * does). If /api/reset-password ever fails with a permission error, grant
 * that service account the "Firebase Authentication Admin" IAM role in
 * Google Cloud Console.
 */

import { getGoogleAccessToken, IDENTITY_TOOLKIT_SCOPE } from './googleAuth.js';

const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

/**
 * Sets a new password for an existing Firebase Auth user, identified by
 * their uid (Identity Toolkit calls this `localId`). The password is
 * stored by Firebase Authentication itself, exactly like a normal
 * sign-up/change-password call — never handled as plain text here.
 */
export async function adminSetPassword(env, uid, newPassword) {
  const accessToken = await getGoogleAccessToken(env, IDENTITY_TOOLKIT_SCOPE);
  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/projects/${env.FIREBASE_PROJECT_ID}/accounts:update`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ localId: uid, password: newPassword, returnSecureToken: false })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Identity Toolkit password update failed (${res.status}): ${errText}`);
  }
  return res.json();
}
