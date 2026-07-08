/**
 * Shared input validation. Kept intentionally strict — this Worker is the
 * only place that is allowed to decide whether a payment is real and
 * whether a test is unlocked, so it must never accept malformed identity
 * data (mobile number) or ids.
 */

const MOBILE_REGEX = /^[6-9]\d{9}$/; // Indian 10-digit mobile numbers

export function normalizeMobile(rawMobile) {
  if (typeof rawMobile !== 'string') return null;
  // Strip spaces, dashes, and a leading +91 / 91 country code if present.
  let mobile = rawMobile.trim().replace(/[\s-]/g, '');
  mobile = mobile.replace(/^\+?91/, '');
  return MOBILE_REGEX.test(mobile) ? mobile : null;
}

export function isNonEmptyString(value, maxLen = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLen;
}

/** Firestore document IDs may not contain "/" and must not be empty. */
export function isValidDocId(value) {
  return isNonEmptyString(value, 300) && !value.includes('/');
}
