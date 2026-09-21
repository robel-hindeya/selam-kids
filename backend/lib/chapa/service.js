/**
 * # NOTE: service.js
 * Role: Payment Orchestration Service
 * Layer: Domain Service / Payments
 * Description: Coordinates checkout creation, status reconciliation, order fulfillment, and webhooks.
 */

import crypto from "node:crypto";
import { pool } from "../postgres.js";
import * as chapaClient from "./client.js";
import { paymentLogger } from "./logger.js";
import * as ordersApi from "./orders.js";
import * as paymentsApi from "./payments.js";
import { PAYMENT_STATUS, ORDER_STATUS, CHAPA_STATUS } from "./status.js";
import {
  generateTxRef,
  centsToAmount,
  amountsMatch,
  currenciesMatch,
  isValidEthiopianPhone,
  verifyWebhookSignature,
} from "./validation.js";

function frontendBaseUrl() {
  const raw = String(process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:8080")
    .trim()
    .split(/\s+/)[0];
  return raw.replace(/\/$/, "");
}

function webhookUrl() {
  // Prefer an explicitly public API base when set (e.g. https://api.example.com).
  // Falls back to APP_URL which must be https for Chapa v2 webhook delivery.
  const apiBase = String(process.env.API_URL || process.env.APP_URL || frontendBaseUrl())
    .trim()
    .split(/\s+/)[0]
    .replace(/\/$/, "");
  return `${apiBase}/api/webhooks/chapa`;
}

/** Browser redirect after Chapa checkout (must resolve to the SPA status page). */
function returnUrlFor(txRef) {
  // Do not encodeURIComponent the path segment — tx refs are URL-safe and
  // double-encoding has caused 404s after Chapa redirects back.
  return `${frontendBaseUrl()}/payment/status/${txRef}`;
}

/**
 * Optional server callback Chapa may hit with a GET (?trx_ref=&status=).
 * Must NOT be the POST-only webhook route (that was returning 404 in the browser).
 */
function browserCallbackUrl() {
  const apiBase = String(process.env.API_URL || process.env.APP_URL || frontendBaseUrl())
    .trim()
    .split(/\s+/)[0]
    .replace(/\/$/, "");
  return `${apiBase}/api/payments/chapa/callback`;
}

function customerName(user) {
  const full = user?.displayName || user?.display_name || user?.fullName || "";
  const parts = String(full).trim().split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" ") || "",
  };
}

export class PaymentError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = "PaymentError";
    this.status = status;
    this.code = code || "payment_error";
  }
}

export function createPaymentService(deps = {}) {
  const {
    client = chapaClient,
    logger = paymentLogger,
    orders = ordersApi,
    payments = paymentsApi,
    dbPool = pool,
  } = deps;

  // ─── Initialize a payment for an existing (verified) order ────────────────
  // order/amounts come from the server, never from the browser.
  async function initializePayment({ order, user }) {
    if (!order || !user) {
      throw new PaymentError(400, "Order and user are required", "missing_context");
    }
    if (order.status === ORDER_STATUS.PAID) {
      throw new PaymentError(409, "This order is already paid.", "order_already_paid");
    }
    if (order.status === ORDER_STATUS.CANCELLED) {
      throw new PaymentError(409, "This order has been cancelled.", "order_cancelled");
    }

    if (!client.isChapaConfigured()) {
      throw new PaymentError(503, "Payments are not configured yet.", "chapa_not_configured");
    }

    // Retry support: reuse a still-valid pending/processing payment so we never
    // create duplicate Chapa transactions for the same order.
    const existing = await payments.findPendingForOrder(order.id);
    if (existing?.checkoutUrl) {
      logger.redirected({
        paymentId: existing.id,
        orderId: order.id,
        txRef: existing.txRef,
        amount: centsToAmount(existing.amountCents),
        currency: existing.currency,
        retried: true,
      });
      return {
        paymentId: existing.id,
        txRef: existing.txRef,
        checkoutUrl: existing.checkoutUrl,
        amount: centsToAmount(existing.amountCents),
        currency: existing.currency,
        reused: true,
      };
    }

    const txRef = generateTxRef(order.id);
    const { firstName, lastName } = customerName(user);
    const email = user?.email || user?.emailAddress || "";
    const phone = typeof user?.phoneNumber === "string" ? user.phoneNumber : "";

    const payment = await payments.createPayment({
      orderId: order.id,
      userId: order.userId,
      txRef,
      amountCents: order.amountCents,
      currency: order.currency,
      customerEmail: email,
      customerPhone: isValidEthiopianPhone(phone) ? phone : "",
      firstName,
      lastName,
      metadata: { orderType: order.orderType, productId: order.productId },
    });

    let result;
    try {
      result = await client.initializeTransaction({
        txRef,
        amount: centsToAmount(order.amountCents),
        email,
        firstName,
        lastName,
        phoneNumber: payment.customerPhone || undefined,
        returnUrl: returnUrlFor(txRef),
        cancelUrl: returnUrlFor(txRef),
        // Browser/GET callback — NOT the signed POST webhook endpoint.
        callbackUrl: browserCallbackUrl(),
        customization: {
          title: "Selam Kids",
          description: order.productTitle ? `Payment for ${order.productTitle}` : "Selam Kids purchase",
        },
        meta: {
          payment_reason: order.productTitle ? `Selam Kids - ${order.productTitle}` : "Selam Kids purchase",
          order_id: order.id,
        },
      });
    } catch (error) {
      await payments.setPaymentStatus(payment.id, PAYMENT_STATUS.FAILED, {
        failureReason: error?.message || "Chapa initialization failed",
        verifiedAt: new Date(),
      });
      logger.failed({
        paymentId: payment.id,
        orderId: order.id,
        txRef,
        amount: centsToAmount(order.amountCents),
        currency: order.currency,
        reason: error?.message || "chapa_initialize_error",
      });
      if (error instanceof chapaClient.ChapaApiError) {
        throw new PaymentError(
          error.status || 502,
          `Payment could not be started: ${error.message || "Please try again."}`,
          error.code || "chapa_initialize_failed",
        );
      }
      throw new PaymentError(502, `Payment could not be started: ${error?.message || "Please try again."}`, "chapa_initialize_failed");
    }

    const updated = await payments.updatePayment(payment.id, {
      checkoutUrl: result.checkoutUrl,
      chapaTransactionId: result.chapaTransactionId || null,
    });

    logger.initialized({
      paymentId: updated.id,
      orderId: order.id,
      txRef: updated.txRef,
      amount: centsToAmount(updated.amountCents),
      currency: updated.currency,
    });

    // Webhook URL is configured in the Chapa dashboard (must be https).
    // Log it so operators know where to point the dashboard setting.
    console.log(`[Chapa] Dashboard webhook URL (configure in Chapa): ${webhookUrl()}`);
    console.log(`[Chapa] Browser return URL: ${returnUrlFor(updated.txRef)}`);

    return {
      paymentId: updated.id,
      txRef: updated.txRef,
      checkoutUrl: updated.checkoutUrl,
      amount: centsToAmount(updated.amountCents),
      currency: updated.currency,
      reused: false,
    };
  }

  // ─── Fulfillment (separate from verification) — idempotent ────────────────
  async function fulfillSuccessfulPayment(payment) {
    const recordedAt = new Date();
    const client = await dbPool.connect();
    try {
      await client.query("BEGIN");
      // Guard against duplicate processing: only the first transition from a
      // non-SUCCESS status performs the fulfillment side effects.
      const updated = await client.query(
        `UPDATE payments SET status = '${PAYMENT_STATUS.SUCCESS}', paid_at = COALESCE(paid_at, $1),
           verified_at = COALESCE(verified_at, $1), updated_at = NOW()
         WHERE id = $2 AND status <> '${PAYMENT_STATUS.SUCCESS}'
         RETURNING *`,
        [recordedAt, payment.id],
      );

      if (updated.rows.length === 0) {
        await client.query("ROLLBACK");
        logger.fulfilled({
          paymentId: payment.id,
          orderId: payment.orderId,
          txRef: payment.txRef,
          amount: centsToAmount(payment.amountCents),
          currency: payment.currency,
          idempotent: true,
        });
        return { fulfilled: false, alreadyFulfilled: true };
      }

      // Mark the order paid.
      await client.query(
        `UPDATE orders SET status = '${ORDER_STATUS.PAID}', updated_at = NOW() WHERE id = $1`,
        [payment.orderId],
      );

      // Business fulfillment: record the magazine sale (existing concept).
      if (payment.metadata?.orderType === "magazine_purchase" || payment.orderId) {
        const orderRow = await client.query(
          "SELECT order_type, product_id FROM orders WHERE id = $1",
          [payment.orderId],
        );
        const order = orderRow.rows[0];
        if (order?.order_type === "magazine_purchase") {
          await client.query(
            `INSERT INTO magazine_sales (id, magazine_id, user_id, amount_cents, created_at)
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
            [
              crypto.randomUUID(),
              order.product_id,
              payment.userId,
              payment.amountCents,
              recordedAt,
            ],
          );
        }
      }

      // Audit trail.
      await client.query(
        `INSERT INTO activity_logs (id, user_id, username, action, details, target_type, target_id, created_at)
         VALUES ($1, $2, '', 'Payment completed', $3, 'payment', $4, $5)`,
        [
          crypto.randomUUID(),
          payment.userId,
          `Payment ${payment.txRef} of ${centsToAmount(payment.amountCents)} ${payment.currency} succeeded for order ${payment.orderId}`,
          payment.orderId,
          recordedAt,
        ],
      );

      await client.query("COMMIT");
      logger.fulfilled({
        paymentId: payment.id,
        orderId: payment.orderId,
        txRef: payment.txRef,
        amount: centsToAmount(payment.amountCents),
        currency: payment.currency,
        idempotent: false,
      });
      return { fulfilled: true, alreadyFulfilled: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      logger.verificationFailed({
        paymentId: payment.id,
        orderId: payment.orderId,
        txRef: payment.txRef,
        reason: error?.message || "fulfillment_failed",
      });
      throw error;
    } finally {
      client.release();
    }
  }

  // ─── Verify a transaction with Chapa and reconcile the DB ─────────────────
  async function verifyAndFulfillPayment({ txRef, source = "callback" }) {
    const payment = await payments.findPaymentByTxRef(txRef);
    if (!payment) {
      throw new PaymentError(404, "Payment not found for this transaction reference.", "payment_not_found");
    }

    if (source === "callback") logger.callbackReceived({ paymentId: payment.id, orderId: payment.orderId, txRef });
    logger.verificationStarted({ paymentId: payment.id, orderId: payment.orderId, txRef, source });

    // Already verified as paid — nothing to do (idempotent).
    if (payment.status === PAYMENT_STATUS.SUCCESS) {
      logger.verificationSuccess({
        paymentId: payment.id,
        orderId: payment.orderId,
        txRef,
        idempotent: true,
      });
      return { payment: paymentDocWithOrder(payment), status: PAYMENT_STATUS.SUCCESS };
    }

    const verification = await client.verifyTransaction(txRef, {
      chapaTransactionId: payment.chapaTransactionId || null,
    });

    if (!verification.ok) {
      // Chapa 404 = transaction not found / not paid yet.
      logger.verificationFailed({
        paymentId: payment.id,
        orderId: payment.orderId,
        txRef,
        reason: verification.notPaid ? "not_paid_yet" : `chapa_http_${verification.status}`,
      });
      return { payment: paymentDocWithOrder(payment), status: payment.status };
    }

    const data = verification.data;
    const chapaStatus = String(data?.status || "").toLowerCase();

    if (chapaStatus === CHAPA_STATUS.SUCCESS) {
      const amountOk = amountsMatch(payment.amountCents, data.amount);
      const currencyOk = currenciesMatch(payment.currency, data.currency);
      // Accept our tx_ref, or an empty merchant_reference (v2 pending→success lag).
      const returnedRef = String(data.tx_ref || data.merchant_reference || "").toLowerCase();
      const txRefOk =
        !returnedRef || returnedRef === String(payment.txRef).toLowerCase();

      if (!amountOk || !currencyOk || !txRefOk) {
        await payments.setPaymentStatus(payment.id, PAYMENT_STATUS.FAILED, {
          failureReason: [
            !txRefOk && "tx_ref mismatch",
            !amountOk && `amount mismatch (expected ${centsToAmount(payment.amountCents)}, got ${data.amount})`,
            !currencyOk && `currency mismatch (expected ${payment.currency}, got ${data.currency})`,
          ]
            .filter(Boolean)
            .join(", ") || "verification mismatch",
          verifiedAt: new Date(),
        });
        logger.verificationFailed({
          paymentId: payment.id,
          orderId: payment.orderId,
          txRef,
          reason: "amount_or_currency_mismatch",
        });
        return { payment: await payments.findPaymentByTxRef(txRef), status: PAYMENT_STATUS.FAILED, mismatch: true };
      }

      const savedCode = await payments.setPaymentStatus(payment.id, PAYMENT_STATUS.PROCESSING, {
        chapaTransactionId: data.reference || payment.chapaTransactionId || null,
        paymentMethod: data.method || data.payment_method || null,
        verifiedAt: new Date(),
      });
      await fulfillSuccessfulPayment(savedCode);
      console.log(`[Chapa] Payment successful for tx_ref: ${txRef}`);
      logger.verificationSuccess({ paymentId: savedCode.id, orderId: savedCode.orderId, txRef });
      return { payment: paymentDocWithOrder(await payments.findPaymentByTxRef(txRef)), status: PAYMENT_STATUS.SUCCESS };
    }

    if (chapaStatus === CHAPA_STATUS.FAILED || chapaStatus === CHAPA_STATUS.CANCELLED) {
      await payments.setPaymentStatus(payment.id, PAYMENT_STATUS.FAILED, {
        failureReason: data.failure_reason || data.message || "Payment failed or cancelled",
        verifiedAt: new Date(),
      });
      logger.failed({ paymentId: payment.id, orderId: payment.orderId, txRef, reason: "chapa_reported_failure" });
      return { payment: await payments.findPaymentByTxRef(txRef), status: PAYMENT_STATUS.FAILED };
    }

    // pending / unknown
    return { payment: paymentDocWithOrder(payment), status: payment.status };
  }

  // ─── Webhook handler (idempotent) ─────────────────────────────────────────
  async function handleChapaWebhook({ rawBody, headers = {}, body }) {
    const secret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!secret) {
      logger.webhookRejected({ reason: "webhook_secret_missing" });
      throw new PaymentError(503, "Webhook secret is not configured.", "webhook_secret_missing");
    }

    const valid = verifyWebhookSignature(rawBody, headers, secret);
    if (!valid) {
      logger.webhookRejected({ reason: "invalid_signature", txRef: body?.tx_ref || body?.txRef });
      throw new PaymentError(401, "Invalid webhook signature.", "invalid_signature");
    }

    const txRef =
      body?.tx_ref ||
      body?.txRef ||
      body?.trx_ref ||
      body?.merchant_reference ||
      body?.data?.tx_ref ||
      body?.data?.merchant_reference;

    logger.webhookReceived({ event: body?.event, txRef });

    if (!txRef) {
      logger.webhookRejected({ reason: "missing_tx_ref" });
      return { ok: true, status: "ignored" };
    }

    const payment = await payments.findPaymentByTxRef(txRef);
    if (!payment) {
      logger.webhookRejected({ reason: "unknown_tx_ref", txRef });
      return { ok: true, status: "unknown" };
    }

    // Neutralize Chapa's legacy space-delimited event name if present.
    const event = String(body?.event || "").replace(/[\s/]+/g, "/").toLowerCase();
    await payments.updatePayment(payment.id, {
      chapaTransactionId:
        body?.chapa_reference ||
        body?.reference ||
        body?.ref_id ||
        payment.chapaTransactionId ||
        null,
      paymentMethod: body?.payment_method || payment.paymentMethod || null,
      webhookReceivedAt: new Date(),
    });

    // Always reconcile against Chapa's verification API (source of truth).
    const { status } = await verifyAndFulfillPayment({ txRef, source: "webhook" });

    if (status === PAYMENT_STATUS.SUCCESS) {
      return { ok: true, status: "success", fulfilled: true };
    }
    if (status === PAYMENT_STATUS.FAILED) {
      return { ok: true, status: "failed" };
    }
    return { ok: true, status: "processed", event };
  }

  return {
    initializePayment,
    verifyAndFulfillPayment,
    handleChapaWebhook,
    fulfillSuccessfulPayment,
  };
}

function paymentDocWithOrder(payment) {
  return payment;
}

export const paymentService = createPaymentService();