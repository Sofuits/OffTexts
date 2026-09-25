/**
 * Input validation.
 *
 * Every function answers a yes/no question and does not throw, so a form can
 * call it while the user is still typing.
 */

// Deliberately permissive. Anything stricter rejects addresses that are valid;
// the only real proof an address works is sending mail to it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Indian mobile: ten digits starting 6-9, with an optional +91 or 0 prefix. */
const INDIAN_MOBILE_PATTERN = /^(?:\+?91|0)?[6-9]\d{9}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

/**
 * Misspellings of gmail.com common enough to be worth catching.
 *
 * Several are valid domains that somebody else owns, so the address passes
 * `isValidEmail` — and the verification code goes to a stranger's mail server,
 * or nowhere. Only suggested, never corrected silently: someone may really use
 * one of them.
 */
const GMAIL_TYPOS = new Set([
  'gmial.com',
  'gmai.com',
  'gmal.com',
  'gamil.com',
  'gmaill.com',
  'gnail.com',
  'gmsil.com',
  'gmail.co',
  'gmail.cm',
  'gmail.om',
  'gmail.con',
  'gmail.comm',
  'gmail.in',
  'gmail',
]);

/**
 * A likely intended address when the domain looks like a mistyped gmail.com.
 * Null when nothing looks wrong.
 */
export function suggestEmailCorrection(value: string): string | null {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at <= 0) return null;
  const domain = email.slice(at + 1);
  return GMAIL_TYPOS.has(domain) ? `${email.slice(0, at)}@gmail.com` : null;
}

export function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE_PATTERN.test(value.replace(/[\s-()]/g, ''));
}

export function isNotEmpty(value: string): boolean {
  return value.trim().length > 0;
}

export function hasMinLength(value: string, min: number): boolean {
  return value.trim().length >= min;
}

export function isInRange(value: number, min: number, max: number): boolean {
  return Number.isFinite(value) && value >= min && value <= max;
}
