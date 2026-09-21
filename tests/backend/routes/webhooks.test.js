/**
 * # NOTE: webhooks.test.js
 * Role: Webhook Route Integration Tests
 * Layer: Testing / API
 * Description: Tests /api/webhooks/chapa signature validation and retry status codes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
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
  return { handle: vi.fn(), MockPaymentError };
});

vi.mock("../../../backend/lib/chapa/service.js", () => ({
  PaymentError: state.MockPaymentError,
  createPaymentService: () => ({ handleChapaWebhook: state.handle }),
}));

const webhookRouter = await import("../../../backend/routes/webhooks.js").then((m) => m.default);

function makeApp() {
  const app = express();
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use("/api/webhooks", webhookRouter);
  return app;
}

describe("POST /api/webhooks/chapa (route)", () => {
  beforeEach(() => {
    state.handle.mockReset();
    state.handle.mockResolvedValue({ ok: true, status: "success", fulfilled: true });
  });

  it("returns 200 for a successfully processed webhook", async () => {
    const body = { event: "charge.success", tx_ref: "HSC-ORDER-12345678-AB12CD" };
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac("sha256", "test-secret").update(raw).digest("hex");

    const res = await request(makeApp())
      .post("/api/webhooks/chapa")
      .set("x-chapa-signature", sig)
      .send(raw)
      .type("json");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, status: "success" });
    expect(state.handle).toHaveBeenCalledTimes(1);
    expect(state.handle.mock.calls[0][0]).toMatchObject({ body, headers: expect.anything() });
  });

  it("returns 401 when the service rejects an invalid signature", async () => {
    state.handle.mockRejectedValue(
      new state.MockPaymentError(401, "Invalid webhook signature.", "invalid_signature"),
    );

    const res = await request(makeApp())
      .post("/api/webhooks/chapa")
      .set("x-chapa-signature", "deadbeef")
      .send({ event: "charge.success" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("invalid_signature");
  });

  it("returns 503 when the webhook secret is not configured", async () => {
    state.handle.mockRejectedValue(
      new state.MockPaymentError(
        503,
        "Webhook secret is not configured.",
        "webhook_secret_missing",
      ),
    );

    const res = await request(makeApp())
      .post("/api/webhooks/chapa")
      .set("x-chapa-signature", "deadbeef")
      .send({ event: "charge.success" });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("webhook_secret_missing");
  });

  it("returns non-200 (500) so Chapa retries on internal errors", async () => {
    state.handle.mockRejectedValue(new Error("unexpected boom"));

    const res = await request(makeApp())
      .post("/api/webhooks/chapa")
      .set("x-chapa-signature", "deadbeef")
      .send({ event: "charge.success" });

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ code: "webhook_internal_error" });
  });

  it("does not leak stack traces to clients", async () => {
    state.handle.mockRejectedValue(new Error("secret stack trace: /srv/app/db.js:42"));

    const res = await request(makeApp())
      .post("/api/webhooks/chapa")
      .set("x-chapa-signature", "deadbeef")
      .send({ event: "charge.success" });

    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("db.js");
    expect(res.body.error).toBe("Internal error");
  });
});
