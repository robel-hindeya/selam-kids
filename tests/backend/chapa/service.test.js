/**
 * # NOTE: service.test.js
 * Role: Payment Service Unit Tests
 * Layer: Testing / Payments
 * Description: Tests checkout session creation, verification logic, and idempotent fulfillment.
 */

import { describe, it, expect, vi } from "vitest";

const mockPayment = (overrides = {}) => ({
  id: "payment-1",
  paymentId: "payment-1",
  orderId: "order-1",
  userId: "user-1",
  txRef: "HSC-ORDER-test-12AB34",
  chapaTransactionId: null,
  amountCents: 5000,
  amount: 50,
  currency: "ETB",
  status: "PENDING",
  paymentMethod: null,
  customerEmail: "test@example.com",
  customerPhone: "",
  firstName: "Test",
  lastName: "User",
  checkoutUrl: "https://chapa.co/checkout/test",
  failureReason: null,
  metadata: { orderType: "magazine_purchase", productId: "mag-abc" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  paidAt: null,
  verifiedAt: null,
  webhookReceivedAt: null,
  ...overrides,
});

const mockOrder = (overrides = {}) => ({
  id: "order-1",
  userId: "user-1",
  orderType: "magazine_purchase",
  productId: "mag-abc",
  productTitle: "Selam Kids Magazine",
  amountCents: 5000,
  amount: 50,
  currency: "ETB",
  status: "PENDING",
  metadata: {},
  ...overrides,
});

const { createPaymentService, PaymentError } =
  await import("../../../backend/lib/chapa/service.js");
const { paymentLogger } = await import("../../../backend/lib/chapa/logger.js");
const { ChapaApiError } = await import("../../../backend/lib/chapa/client.js");

const loggerMethods = [
  "initialized",
  "redirected",
  "callbackReceived",
  "verificationStarted",
  "verificationSuccess",
  "verificationFailed",
  "webhookReceived",
  "webhookRejected",
  "fulfilled",
  "failed",
  "refunded",
];

function stubLogger() {
  return Object.fromEntries(loggerMethods.map((m) => [m, vi.fn()]));
}

function makeClient({ verifyData } = {}) {
  return {
    isChapaConfigured: () => true,
    ChapaApiError,
    initializeTransaction: vi.fn(async () => ({ checkoutUrl: "https://chapa.co/checkout/new" })),
    verifyTransaction: vi.fn(
      async () =>
        verifyData ?? {
          ok: true,
          data: {
            status: "SUCCESS",
            amount: "50.00",
            currency: "ETB",
            reference: "chapa-tx-123",
            tx_ref: "HSC-ORDER-test-12AB34",
          },
        },
    ),
  };
}

function makePayments(overrides) {
  return {
    createPayment: vi.fn(async () => mockPayment({ checkoutUrl: null })),
    updatePayment: vi.fn(async (id, updates) =>
      mockPayment({
        id,
        ...updates,
        checkoutUrl: updates.checkoutUrl || "https://chapa.co/checkout/new",
      }),
    ),
    setPaymentStatus: vi.fn(async (id, status, extra = {}) =>
      mockPayment({ id, status, ...extra }),
    ),
    findPaymentByTxRef: vi.fn(async () => null),
    findPaymentById: vi.fn(async () => null),
    findByOrderId: vi.fn(async () => []),
    findPendingForOrder: vi.fn(async () => null),
    ...overrides,
  };
}

function makeOrders(overrides) {
  return {
    createOrder: vi.fn(async () => mockOrder()),
    findOrderById: vi.fn(async () => null),
    findActiveOrderForProduct: vi.fn(async () => null),
    ...overrides,
  };
}

// Mock the DB client used by fulfillSuccessfulPayment. `updatedRows=0` makes
// the UPDATE ... WHERE status <> 'SUCCESS' guard see no rows (idempotent case).
// Once a fulfillment has succeeded, subsequent calls see no matching row —
// modelling the real DB row already being SUCCESS (idempotent re-delivery).
function dbClient(updatedRows = 1) {
  const calls = [];
  let alreadySucceeded = false;
  const query = vi.fn(async () => {
    const n = calls.length;
    calls.push(n);
    if (n === 0) return { rows: [] }; // BEGIN
    if (n === 1 && updatedRows === 0) return { rows: [] }; // optimistic UPDATE no-op
    if (n === 1) {
      if (alreadySucceeded) return { rows: [] }; // DB already SUCCESS -> guard blocks
      alreadySucceeded = true;
      return { rows: [{ id: "payment-1" }] }; // UPDATE payments -> row
    }
    if (n === 2 && updatedRows === 0) return { rows: [] }; // ROLLBACK
    if (n === 2) return { rows: [] }; // UPDATE orders
    if (n === 3) return { rows: [] }; // SELECT order (none => skip sales insert)
    if (n === 4) return { rows: [] }; // INSERT activity_logs
    if (n === 5) return { rows: [] }; // COMMIT
    return { rows: [] };
  });
  return { query, release: vi.fn() };
}

function dbPool(client) {
  return { connect: vi.fn(async () => client) };
}

describe("createPaymentService.initializePayment", () => {
  it("creates a pending payment and returns the Chapa checkout URL", async () => {
    const pool = dbPool(dbClient());
    const svc = createPaymentService({
      dbPool: pool,
      payments: makePayments(),
      orders: makeOrders(),
      client: makeClient(),
      logger: stubLogger(),
    });

    const result = await svc.initializePayment({
      order: mockOrder(),
      user: { email: "test@example.com" },
    });
    expect(result).toMatchObject({
      txRef: "HSC-ORDER-test-12AB34",
      checkoutUrl: "https://chapa.co/checkout/new",
      amount: 50,
      currency: "ETB",
    });
  });

  it("rejects when order or user is missing", async () => {
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments: makePayments(),
      orders: makeOrders(),
      client: makeClient(),
      logger: stubLogger(),
    });
    await expect(svc.initializePayment({ order: null, user: {} })).rejects.toThrow(/required/i);
  });

  it("reuses an existing pending payment with checkout URL", async () => {
    const pool = dbPool(dbClient());
    const payments = makePayments({
      findPendingForOrder: vi.fn(async () =>
        mockPayment({
          txRef: "HSC-ORDER-existing-ABC123",
          checkoutUrl: "https://chapa.co/checkout/existing",
        }),
      ),
    });
    const client = makeClient();
    const svc = createPaymentService({
      dbPool: pool,
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.initializePayment({
      order: mockOrder(),
      user: { email: "test@example.com" },
    });
    expect(result).toMatchObject({
      txRef: "HSC-ORDER-existing-ABC123",
      checkoutUrl: "https://chapa.co/checkout/existing",
      reused: true,
    });
    expect(client.initializeTransaction).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
  });

  it("rejects paid orders", async () => {
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments: makePayments(),
      orders: makeOrders(),
      client: makeClient(),
      logger: stubLogger(),
    });
    await expect(
      svc.initializePayment({ order: mockOrder({ status: "PAID" }), user: {} }),
    ).rejects.toThrow(/paid/i);
  });
});

describe("createPaymentService.verifyAndFulfillPayment", () => {
  it("marks payment + order paid and fulfills on SUCCESS verification", async () => {
    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () => mockPayment()),
    });
    const client = makeClient();
    const svc = createPaymentService({
      dbPool: dbPool(dbClient(1)),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.verifyAndFulfillPayment({
      txRef: "HSC-ORDER-test-12AB34",
      source: "callback",
    });
    expect(result.status).toBe("SUCCESS");
    expect(client.verifyTransaction).toHaveBeenCalledWith("HSC-ORDER-test-12AB34", {
      chapaTransactionId: null,
    });
    expect(payments.setPaymentStatus).toHaveBeenCalledWith(
      "payment-1",
      "PROCESSING",
      expect.objectContaining({ chapaTransactionId: "chapa-tx-123", paymentMethod: null }),
    );
  });

  it("returns FAILED (mismatch) when Chapa amount does not match", async () => {
    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () => mockPayment()),
    });
    const client = makeClient({
      verifyData: {
        ok: true,
        data: {
          status: "SUCCESS",
          amount: "99.00",
          currency: "ETB",
          reference: "chapa-tx-123",
          tx_ref: "HSC-ORDER-test-12AB34",
        },
      },
    });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.verifyAndFulfillPayment({
      txRef: "HSC-ORDER-test-12AB34",
      source: "webhook",
    });
    expect(result.status).toBe("FAILED");
    expect(result.mismatch).toBe(true);
    expect(payments.setPaymentStatus).toHaveBeenCalledWith(
      "payment-1",
      "FAILED",
      expect.objectContaining({ failureReason: expect.stringContaining("amount mismatch") }),
    );
  });

  it("is idempotent when payment is already SUCCESS", async () => {
    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () =>
        mockPayment({ status: "SUCCESS", paidAt: new Date().toISOString() }),
      ),
    });
    const client = makeClient();
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.verifyAndFulfillPayment({ txRef: "HSC-ORDER-test-12AB34" });
    expect(result.status).toBe("SUCCESS");
    expect(client.verifyTransaction).not.toHaveBeenCalled();
  });

  it("returns status un-changed when Chapa reports not paid yet", async () => {
    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () => mockPayment()),
    });
    const client = makeClient({ verifyData: { ok: false, status: 404, notPaid: true } });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.verifyAndFulfillPayment({ txRef: "HSC-ORDER-test-12AB34" });
    expect(result.status).toBe("PENDING");
  });
});

describe("createPaymentService.handleChapaWebhook", () => {
  it("rejects when CHAPA_WEBHOOK_SECRET is unset", async () => {
    const old = process.env.CHAPA_WEBHOOK_SECRET;
    delete process.env.CHAPA_WEBHOOK_SECRET;
    try {
      const svc = createPaymentService({
        dbPool: dbPool(dbClient()),
        payments: makePayments(),
        orders: makeOrders(),
        client: makeClient(),
        logger: stubLogger(),
      });
      await expect(
        svc.handleChapaWebhook({ rawBody: "{}", headers: {}, body: {} }),
      ).rejects.toThrow(/not configured/i);
    } finally {
      if (old) process.env.CHAPA_WEBHOOK_SECRET = old;
    }
  });

  it("rejects requests with a bad signature", async () => {
    process.env.CHAPA_WEBHOOK_SECRET = "secret";
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments: makePayments(),
      orders: makeOrders(),
      client: makeClient(),
      logger: stubLogger(),
    });
    await expect(
      svc.handleChapaWebhook({
        rawBody: '{"event":"charge.success"}',
        headers: { "x-chapa-signature": "deadbeef" },
        body: { event: "charge.success" },
      }),
    ).rejects.toThrow(/signature/i);
    delete process.env.CHAPA_WEBHOOK_SECRET;
  });

  it("fulfills a signed charge.success webhook", async () => {
    process.env.CHAPA_WEBHOOK_SECRET = "secret";
    const crypto = await import("node:crypto");
    const raw = JSON.stringify({ event: "charge.success", tx_ref: "HSC-ORDER-test-12AB34" });
    const sig = crypto.createHmac("sha256", "secret").update(raw).digest("hex");

    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () => mockPayment()),
      updatePayment: vi.fn(async (id, updates) => mockPayment({ id, ...updates })),
    });
    const client = makeClient();
    const svc = createPaymentService({
      dbPool: dbPool(dbClient(1)),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.handleChapaWebhook({
      rawBody: Buffer.from(raw),
      headers: { "x-chapa-signature": sig },
      body: JSON.parse(raw),
    });
    expect(result).toMatchObject({ ok: true, status: "success", fulfilled: true });
    delete process.env.CHAPA_WEBHOOK_SECRET;
  });
});

describe("createPaymentService — security & edge cases", () => {
  it("returns FAILED (mismatch) when Chapa currency does not match", async () => {
    const payments = makePayments({ findPaymentByTxRef: vi.fn(async () => mockPayment()) });
    const client = makeClient({
      verifyData: {
        ok: true,
        data: {
          status: "SUCCESS",
          amount: "50.00",
          currency: "USD",
          reference: "chapa-tx-123",
          tx_ref: "HSC-ORDER-test-12AB34",
        },
      },
    });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const result = await svc.verifyAndFulfillPayment({ txRef: "HSC-ORDER-test-12AB34" });
    expect(result.status).toBe("FAILED");
    expect(result.mismatch).toBe(true);
    expect(payments.setPaymentStatus).toHaveBeenCalledWith(
      "payment-1",
      "FAILED",
      expect.objectContaining({ failureReason: expect.stringContaining("currency mismatch") }),
    );
  });

  it("propagates errors when the Chapa verify API fails / times out", async () => {
    const payments = makePayments({ findPaymentByTxRef: vi.fn(async () => mockPayment()) });
    const client = makeClient({ verifyData: new Error("socket hang up (timeout)") });
    client.verifyTransaction = vi.fn(async () => {
      throw new Error("socket hang up");
    });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    await expect(svc.verifyAndFulfillPayment({ txRef: "HSC-ORDER-test-12AB34" })).rejects.toThrow(
      "socket hang up",
    );
    expect(payments.setPaymentStatus).not.toHaveBeenCalled();
  });

  it("throws PaymentError and marks payment FAILED when Chapa initialize fails", async () => {
    const payments = makePayments();
    const client = makeClient();
    client.initializeTransaction = vi.fn(async () => {
      throw new ChapaApiError(502, "Chapa unavailable", "chapa_error");
    });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    const payment = await svc
      .initializePayment({ order: mockOrder(), user: { email: "test@example.com" } })
      .catch((e) => {
        expect(e).toBeInstanceOf(PaymentError);
        expect(e.status).toBe(502);
        return e;
      });
    expect(payments.setPaymentStatus).toHaveBeenCalledWith(
      "payment-1",
      "FAILED",
      expect.objectContaining({ failureReason: expect.any(String) }),
    );
    expect(payment?.message).toMatch(/could not be started/i);
  });

  it("treats a Chapa initialize timeout like an API failure (no checkout_url stored)", async () => {
    const payments = makePayments();
    const client = makeClient();
    client.initializeTransaction = vi.fn(async () => {
      const err = new Error("timeout of 10000ms exceeded");
      err.name = "TimeoutError";
      throw err;
    });
    const svc = createPaymentService({
      dbPool: dbPool(dbClient()),
      payments,
      orders: makeOrders(),
      client,
      logger: stubLogger(),
    });

    try {
      await svc.initializePayment({ order: mockOrder(), user: { email: "test@example.com" } });
      expect.unreachable();
    } catch (err) {
      expect(err.status).toBe(502);
    }
    expect(payments.setPaymentStatus).toHaveBeenCalledWith(
      "payment-1",
      "FAILED",
      expect.any(Object),
    );
    expect(payments.updatePayment).not.toHaveBeenCalled();
  });

  it("fulfillSuccessfulPayment is idempotent when the optimistic UPDATE matches no row", async () => {
    const pool = dbPool(dbClient(0));
    const payments = makePayments();
    const svc = createPaymentService({
      dbPool: pool,
      payments,
      orders: makeOrders(),
      client: makeClient(),
      logger: stubLogger(),
    });

    const result = await svc.fulfillSuccessfulPayment(mockPayment());
    expect(result).toEqual({ fulfilled: false, alreadyFulfilled: true });
  });

  it("delivering the same webhook twice only fulfills once", async () => {
    process.env.CHAPA_WEBHOOK_SECRET = "secret";
    const crypto = await import("node:crypto");
    const raw = JSON.stringify({ event: "charge.success", tx_ref: "HSC-ORDER-test-12AB34" });
    const sig = crypto.createHmac("sha256", "secret").update(raw).digest("hex");

    let payment = mockPayment();
    const payments = makePayments({
      findPaymentByTxRef: vi.fn(async () => payment),
      updatePayment: vi.fn(async (id, updates) => {
        payment = mockPayment({ id, ...updates });
        return payment;
      }),
      setPaymentStatus: vi.fn(async (id, status, extra = {}) => {
        payment = mockPayment({ id, status, ...extra });
        return payment;
      }),
    });
    const client = makeClient();
    const mockLoggerForSvcs = stubLogger();
    const svc = createPaymentService({
      dbPool: dbPool(dbClient(1)),
      payments,
      orders: makeOrders(),
      client,
      logger: mockLoggerForSvcs,
    });

    const first = await svc.handleChapaWebhook({
      rawBody: Buffer.from(raw),
      headers: { "x-chapa-signature": sig },
      body: JSON.parse(raw),
    });
    expect(first).toMatchObject({ ok: true, status: "success", fulfilled: true });

    // Second delivery — Chapa is reconciled again, but the DB guard prevents
    // a second fulfillment (entitlement granted exactly once).
    const second = await svc.handleChapaWebhook({
      rawBody: Buffer.from(raw),
      headers: { "x-chapa-signature": sig },
      body: JSON.parse(raw),
    });
    expect(second).toMatchObject({ ok: true, status: "success" });
    expect(client.verifyTransaction).toHaveBeenCalledTimes(2);
    expect(mockLoggerForSvcs.fulfilled).toHaveBeenCalledTimes(2);
    expect(mockLoggerForSvcs.fulfilled).toHaveBeenLastCalledWith(
      expect.objectContaining({ idempotent: true }),
    );
    delete process.env.CHAPA_WEBHOOK_SECRET;
  });
});
