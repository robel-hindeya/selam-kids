import { Router } from "express";
import { Magazine } from "../models/Content.js";
import { requireAuth } from "../middleware/auth.js";
import { createPaymentService, PaymentError } from "../lib/chapa/service.js";
import { findActiveOrderForProduct, createOrder, findOrderById } from "../lib/chapa/orders.js";
import { findPaymentByTxRef, findPaymentById, paymentDoc } from "../lib/chapa/payments.js";
import { createRateLimiter } from "../lib/chapa/rate-limit.js";
import { centsToAmount } from "../lib/chapa/validation.js";

const router = Router();

const { initializePayment, verifyAndFulfillPayment } = createPaymentService();

const createLimiter = createRateLimiter({ windowMs: 60_000, max: 20 });

// POST /api/payments/chapa/create
// Body: { productId: "<magazine id>", phoneNumber?: "09xxxxxxxx" }
// Creates (or reuses) an order + a pending payment, then asks Chapa for a
// hosted checkout URL. Amounts are computed server-side from the DB.
router.post("/chapa/create", requireAuth, createLimiter, async (req, res) => {
  try {
    const { productId, phoneNumber } = req.body || {};
    if (!productId || typeof productId !== "string") {
      return res.status(400).json({ error: "productId is required." });
    }

    const magazine = await Magazine.findById(productId);
    if (!magazine || magazine.active === false) {
      return res.status(404).json({ error: "This magazine is no longer available." });
    }
    if (!Number.isInteger(Number(magazine.priceCents)) || Number(magazine.priceCents) <= 0) {
      return res.status(400).json({ error: "This product does not have a valid price." });
    }

    // Reuse a still-active order for this product so retries keep the same
    // order (and the same pending payment when one exists).
    let order = await findActiveOrderForProduct(req.userId, productId);
    if (!order) {
      order = await createOrder({
        userId: req.userId,
        orderType: "magazine_purchase",
        productId: magazine._id,
        productTitle: magazine.title,
        amountCents: Number(magazine.priceCents),
        currency: "ETB",
        metadata: { edition: magazine.edition || "", category: magazine.category || "" },
      });
    }

    const userWithPhone = {
      ...req.user,
      phoneNumber: typeof phoneNumber === "string" ? phoneNumber.trim() : undefined,
    };

    const result = await initializePayment({ order, user: userWithPhone });

    return res.json({
      paymentId: result.paymentId,
      txRef: result.txRef,
      checkoutUrl: result.checkoutUrl,
      amount: result.amount,
      currency: result.currency,
      orderId: order.id,
      productTitle: order.productTitle,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      return res.status(error.status || 502).json({ error: error.message, code: error.code });
    }
    console.error("Failed to create Chapa payment:", error);
    return res.status(500).json({ error: "Could not start the payment. Please try again.", code: "server_error" });
  }
});

// GET /api/payments/chapa/verify/:txRef
// Server-side verification against Chapa. This is what the frontend status
// page calls after the user returns from Chapa (and is also polled while the
// transaction is pending). Never trusts the browser.
router.get("/chapa/verify/:txRef", requireAuth, async (req, res) => {
  const { txRef } = req.params;
  try {
    const payment = await findPaymentByTxRef(txRef);
    if (!payment || payment.userId !== req.userId) {
      return res.status(404).json({ error: "Payment not found." });
    }

    const { status, mismatch } = await verifyAndFulfillPayment({ txRef, source: "callback" });
    const latest = await findPaymentByTxRef(txRef);
    const order = latest.orderId ? await findOrderById(latest.orderId) : null;

    return res.json({
      paymentId: latest.id,
      txRef: latest.txRef,
      status: latest.status,
      amount: centsToAmount(latest.amountCents),
      currency: latest.currency,
      paymentMethod: latest.paymentMethod,
      failureReason: latest.failureReason,
      paidAt: latest.paidAt,
      fulfillmentVerified: status === "SUCCESS",
      mismatch: Boolean(mismatch),
      order: order
        ? {
            id: order.id,
            orderType: order.orderType,
            productId: order.productId,
            productTitle: order.productTitle,
            amount: order.amount,
            status: order.status,
          }
        : null,
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      if (error.status === 404) return res.status(404).json({ error: error.message });
      return res.status(503).json({ error: error.message, code: error.code });
    }
    console.error("Failed to verify Chapa payment:", error);
    return res.status(500).json({ error: "Could not verify the payment.", code: "server_error" });
  }
});

// GET /api/payments/:paymentId
// Returns a single payment row owned by the authenticated user.
router.get("/:paymentId", requireAuth, async (req, res) => {
  try {
    const payment = await findPaymentById(req.params.paymentId);
    if (!payment || payment.userId !== req.userId) {
      return res.status(404).json({ error: "Payment not found." });
    }
    return res.json(paymentDoc(payment));
  } catch {
    return res.status(500).json({ error: "Could not load the payment.", code: "server_error" });
  }
});

export default router;