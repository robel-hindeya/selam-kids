/**
 * # NOTE: logger.js
 * Role: Payment Structured Audit Logger
 * Layer: Domain Service / Observability
 * Description: Structured logger tracking payment sessions, verifications, failures, and fulfillment.
 */

// Structured payment logging. Every payment event is emitted as a single
// JSON line so it can be indexed by any log pipeline (Vercel, pino, etc.).
// Never pass secret keys, credentials, card data, OTPs or PINs to these calls.
export function logPayment(event, fields = {}) {
  const record = { ts: new Date().toISOString(), event };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    record[key] = value;
  }
  console.log(JSON.stringify(record));
}

export const paymentLogger = {
  initialized: (fields) => logPayment("payment.initialized", fields),
  redirected: (fields) => logPayment("payment.redirected", fields),
  callbackReceived: (fields) => logPayment("payment.callback_received", fields),
  verificationStarted: (fields) => logPayment("payment.verification_started", fields),
  verificationSuccess: (fields) => logPayment("payment.verification_success", fields),
  verificationFailed: (fields) => logPayment("payment.verification_failed", fields),
  webhookReceived: (fields) => logPayment("payment.webhook_received", fields),
  webhookRejected: (fields) => logPayment("payment.webhook_rejected", fields),
  fulfilled: (fields) => logPayment("payment.fulfilled", fields),
  failed: (fields) => logPayment("payment.failed", fields),
  refunded: (fields) => logPayment("payment.refunded", fields),
};