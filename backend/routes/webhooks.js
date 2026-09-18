import { Router } from "express";
import { createPaymentService, PaymentError } from "../lib/chapa/service.js";
import { createRateLimiter } from "../lib/chapa/rate-limit.js";

const router = Router();

const { handleChapaWebhook } = createPaymentService();

const webhookLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

function frontendBaseUrl() {
  const raw = String(process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:8080")
    .trim()
    .split(/\s+/)[0];
  return raw.replace(/\/$/, "");
}

/**
 * GET /api/webhooks/chapa
 * Safety net: if Chapa (or an old dashboard setting) sends the browser to the
 * webhook URL, redirect to the payment status page instead of Express 404.
 */
router.get("/chapa", (req, res) => {
  const txRef =
    req.query.trx_ref ||
    req.query.tx_ref ||
    req.query.txRef ||
    req.query.merchant_reference ||
    req.query.reference;

  if (txRef) {
    return res.redirect(
      302,
      `${frontendBaseUrl()}/payment/status/${encodeURIComponent(String(txRef))}`,
    );
  }
  return res.redirect(302, `${frontendBaseUrl()}/home`);
});

// POST /api/webhooks/chapa
// Receives Chapa webhook events (charge.success, charge.failed/cancelled, ...).
// Signature is validated (chapa-signature / x-chapa-signature) before any
// processing. Idempotent by design — duplicate deliveries are acknowledged
// with 200 without side effects.
router.post("/chapa", webhookLimiter, async (req, res) => {
  const rawBody = req?.rawBody || Buffer.from(JSON.stringify(req.body || {}), "utf8");
  const body = req.body || {};
  try {
    const outcome = await handleChapaWebhook({ rawBody, headers: req.headers, body });
    return res.status(200).json({ ok: true, status: outcome.status });
  } catch (error) {
    if (error instanceof PaymentError) {
      // Invalid signature must NOT be acknowledged as success.
      if (error.status === 401) {
        return res.status(401).json({ error: error.message, code: error.code });
      }
      if (error.status === 503) {
        return res.status(503).json({ error: error.message, code: error.code });
      }
      return res.status(400).json({ error: error.message, code: error.code });
    }
    // Transient failure — return non-200 so Chapa retries the webhook.
    // eslint-disable-next-line no-console
    console.error("Webhook processing failed:", error);
    return res.status(500).json({ error: "Internal error", code: "webhook_internal_error" });
  }
});

export default router;