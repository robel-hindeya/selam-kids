import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const state = vi.hoisted(() => {
  class MockPaymentError extends Error {
    constructor(status, message, code = "payment_error") {
      super(message);
      this.name = "PaymentError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    MockPaymentError,
    initializePayment: vi.fn(),
    verifyAndFulfillPayment: vi.fn(),
    findPaymentByTxRef: vi.fn(),
    findPaymentById: vi.fn(),
    findOrderById: vi.fn(),
    findActiveOrderForProduct: vi.fn(),
    findById: vi.fn(),
    paymentDoc: (row) => row || null,
  };
});

vi.mock("../../../backend/lib/chapa/service.js", () => ({
  PaymentError: state.MockPaymentError,
  createPaymentService: () => ({
    initializePayment: state.initializePayment,
    verifyAndFulfillPayment: state.verifyAndFulfillPayment,
  }),
}));

vi.mock("../../../backend/middleware/auth.js", () => ({
  requireAuth: (req, _res, next) => {
    req.userId = "user-1";
    req.user = { id: "user-1", email: "kid@example.com", displayName: "Kid One" };
    next();
  },
}));

vi.mock("../../../backend/lib/chapa/orders.js", () => ({
  findActiveOrderForProduct: state.findActiveOrderForProduct,
  createOrder: vi.fn(async ({ amountCents, currency }) => ({
    id: "order-1",
    orderType: "magazine_purchase",
    productId: "mag-abc",
    productTitle: "Selam Kids Magazine",
    amountCents,
    currency,
    amount: amountCents / 100,
    status: "PENDING",
  })),
  findOrderById: state.findOrderById,
}));

vi.mock("../../../backend/lib/chapa/payments.js", () => ({
  findPaymentByTxRef: state.findPaymentByTxRef,
  findPaymentById: state.findPaymentById,
  paymentDoc: state.paymentDoc,
}));

vi.mock("../../../backend/models/Content.js", () => ({
  Magazine: {
    findById: state.findById,
  },
}));

const paymentsRouter = await import("../../../backend/routes/payments.js").then((m) => m.default);

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/payments", paymentsRouter);
  return app;
}

function ownedPayment(status = "SUCCESS") {
  return {
    id: "payment-1",
    orderId: "order-1",
    userId: "user-1",
    txRef: "HSC-ORDER-test-12AB34",
    amountCents: 5000,
    currency: "ETB",
    status,
    paymentMethod: "telebirr",
    failureReason: null,
    paidAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    webhookReceivedAt: null,
  };
}

describe("GET /api/payments/chapa/verify/:txRef (route)", () => {
  beforeEach(() => {
    state.initializePayment.mockReset();
    state.verifyAndFulfillPayment.mockReset();
    state.findPaymentByTxRef.mockReset();
    state.findPaymentById.mockReset();
    state.findOrderById.mockReset();
    state.findById.mockReset();
  });

  it("rejects verifying a payment that belongs to another user (404)", async () => {
    state.findPaymentByTxRef.mockResolvedValue({ ...ownedPayment(), userId: "someone-else" });

    const res = await request(makeApp()).get("/api/payments/chapa/verify/HSC-ORDER-test-12AB34");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Payment not found.");
    expect(state.verifyAndFulfillPayment).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown txRef", async () => {
    state.findPaymentByTxRef.mockResolvedValue(null);

    const res = await request(makeApp()).get("/api/payments/chapa/verify/UNKNOWN-TX");

    expect(res.status).toBe(404);
  });

  it("returns the verified payload for an owned payment", async () => {
    state.findPaymentByTxRef.mockResolvedValueOnce(ownedPayment("PENDING"));
    state.verifyAndFulfillPayment.mockResolvedValueOnce({ status: "SUCCESS" });
    state.findPaymentByTxRef.mockResolvedValueOnce({
      ...ownedPayment("SUCCESS"),
      paidAt: new Date().toISOString(),
    });
    state.findOrderById.mockResolvedValue({
      id: "order-1",
      orderType: "magazine_purchase",
      productId: "mag-abc",
      productTitle: "Selam Kids Magazine",
      amount: 50,
      status: "PAID",
    });

    const res = await request(makeApp()).get("/api/payments/chapa/verify/HSC-ORDER-test-12AB34");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      txRef: "HSC-ORDER-test-12AB34",
      status: "SUCCESS",
      amount: 50,
      currency: "ETB",
      fulfillmentVerified: true,
      mismatch: false,
      order: { status: "PAID" },
    });
  });
});

describe("POST /api/payments/chapa/create (route)", () => {
  beforeEach(() => {
    state.initializePayment.mockReset();
    state.verifyAndFulfillPayment.mockReset();
    state.findPaymentByTxRef.mockReset();
    state.findActiveOrderForProduct.mockReset();
    state.findById.mockReset();
    state.initializePayment.mockResolvedValue({
      paymentId: "payment-1",
      txRef: "HSC-ORDER-test-12AB34",
      checkoutUrl: "https://checkout.chapa.co/session/123",
      amount: 50,
      currency: "ETB",
    });
  });

  it("rejects a missing productId", async () => {
    const res = await request(makeApp()).post("/api/payments/chapa/create").send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/productId/i);
  });

  it("rejects an unavailable magazine", async () => {
    state.findById.mockResolvedValue(null);

    const res = await request(makeApp())
      .post("/api/payments/chapa/create")
      .send({ productId: "mag-abc" });

    expect(res.status).toBe(404);
  });

  it("rejects a magazine without a valid price", async () => {
    state.findById.mockResolvedValue({ _id: "mag-abc", active: true, priceCents: 0 });

    const res = await request(makeApp())
      .post("/api/payments/chapa/create")
      .send({ productId: "mag-abc" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/price/i);
  });

  it("creates a payment with the server-side amount (ignores any client amount)", async () => {
    state.findById.mockResolvedValue({
      _id: "mag-abc",
      active: true,
      title: "Selam Kids Magazine",
      priceCents: 7500,
      edition: "Q1",
      category: "Fun",
    });
    state.findActiveOrderForProduct.mockResolvedValue(null);

    const res = await request(makeApp())
      .post("/api/payments/chapa/create")
      .send({ productId: "mag-abc", amount: 1, currency: "USD" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      paymentId: "payment-1",
      txRef: "HSC-ORDER-test-12AB34",
      checkoutUrl: "https://checkout.chapa.co/session/123",
      amount: 50,
      currency: "ETB",
      orderId: "order-1",
    });
    expect(state.initializePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ amountCents: 7500, currency: "ETB" }),
        user: expect.objectContaining({ id: "user-1" }),
      }),
    );
  });
});
