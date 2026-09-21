/**
 * # NOTE: validation.js
 * Role: Payment Payload Validator
 * Layer: Domain / Security
 * Description: Validates payment initialization inputs, currency codes, and transaction references.
 */

import crypto from "node:crypto";

// ─── Transaction reference ──────────────────────────────────────────────────
// Example format: HSC-ORDER-<orderId:8>-<random6>
// Globally unique (database UNIQUE constraint + random suffix), traceable to
// the internal order, safe to log, and never generated from a timestamp alone.
export function generateTxRef(orderId) {
  const orderShort = String(orderId || "").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `HSC-ORDER-${orderShort || "XXXX"}-${random}`;
}

// ─── Ethiopian phone numbers ────────────────────────────────────────────────
// Chapa requires a phone number to be 10 digits: 09xxxxxxxx or 07xxxxxxxx.
export const ETHIOPIAN_PHONE_PATTERN = /^0(9|7)\d{8}$/;

export function isValidEthiopianPhone(phoneNumber) {
  return Boolean(phoneNumber && ETHIOPIAN_PHONE_PATTERN.test(String(phoneNumber).trim()));
}

// ─── Money helpers ──────────────────────────────────────────────────────────
export function normalizeAmountToCents(amount) {
  return Math.round(Number(amount) * 100);
}

export function centsToAmount(cents) {
  const amount = Number(cents) / 100;
  // Avoid floating point artifacts: 5000 -> 50, 4580 -> 45.8
  return Math.round(amount * 100) / 100;
}

export function amountsMatch(wantCents, chapaAmount) {
  if (chapaAmount === undefined || chapaAmount === null) return false;
  return wantCents === normalizeAmountToCents(chapaAmount);
}

export function currenciesMatch(want, chapaCurrency) {
  return Boolean(chapaCurrency && String(want).toUpperCase() === String(chapaCurrency).toUpperCase());
}

// ─── Webhook signature verification ─────────────────────────────────────────
// Per official Chapa docs:
//   - `x-chapa-signature` is an HMAC-SHA256 of the raw event payload signed
//     with the webhook secret.
//   - `chapa-signature` is an HMAC-SHA256 of the secret key signed with the
//     secret key itself.
// We accept the request if either header is present and matches its expected
// value. If both are present, at least one must match. Requests with no valid
// signature are discarded.
function hmac(secret, data) {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a, b) {
  const left = Buffer.from(String(a || ""), "hex");
  const right = Buffer.from(String(b || ""), "hex");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/**
 * @param {Buffer|string} rawBody - the raw webhook request body
 * @param {Record<string,string|string[]|undefined>} headers - request headers
 * @param {string} secret - CHAPA_WEBHOOK_SECRET
 * @returns {boolean}
 */
export function verifyWebhookSignature(rawBody, headers, secret) {
  if (!secret) return false;

  const body = rawBody instanceof Buffer ? rawBody : Buffer.from(String(rawBody ?? ''), "utf8");
  const xChapa = String(headers["x-chapa-signature"] || headers["X-Chapa-Signature"] || "");
  const chapaSig = String(headers["chapa-signature"] || headers["Chapa-Signature"] || "");

  const expectX = hmac(secret, body);
  const expectChapa = hmac(secret, secret);

  const xValid = xChapa && safeEqualHex(expectX, xChapa);
  const chapaValid = chapaSig && safeEqualHex(expectChapa, chapaSig);

  if (!xChapa && !chapaSig) return false;
  return xValid || chapaValid;
}

// ─── Email / input sanity helpers ───────────────────────────────────────────
export function isEmail(value) {
  return typeof value === "string" && /^\S+@\S+\.\S+$/.test(value.trim());
}