import { describe, it, expect } from "vitest";
import {
  statusFromChapaEvent,
  PAYMENT_STATUS,
  ORDER_STATUS,
  CHAPA_STATUS,
  CHAPA_EVENT,
} from "../../../backend/lib/chapa/status.js";

describe("Chapa status enums", () => {
  it("exports all payment statuses", () => {
    expect(Object.values(PAYMENT_STATUS)).toEqual(
      expect.arrayContaining([
        "PENDING",
        "PROCESSING",
        "SUCCESS",
        "FAILED",
        "CANCELLED",
        "EXPIRED",
        "REFUNDED",
      ]),
    );
  });

  it("exports all order statuses", () => {
    expect(Object.values(ORDER_STATUS)).toEqual(
      expect.arrayContaining(["PENDING", "PAID", "FAILED", "CANCELLED"]),
    );
  });

  it("exports Chapa event aliases", () => {
    expect(CHAPA_EVENT).toMatchObject({
      CHARGE_SUCCESS: "charge.success",
      CHARGE_REFUNDED: "charge.refunded",
      CHARGE_FAILED_CANCELLED: "charge.failed/cancelled",
    });
  });

  it("exports Chapa status aliases (lowercase, as returned by Chapa verify)", () => {
    expect(CHAPA_STATUS.SUCCESS).toBe("success");
    expect(CHAPA_STATUS.FAILED).toBe("failed");
    expect(CHAPA_STATUS.CANCELLED).toBe("cancelled");
  });
});

describe("statusFromChapaEvent", () => {
  it("maps charge.success to SUCCESS", () => {
    expect(statusFromChapaEvent("charge.success")).toBe(PAYMENT_STATUS.SUCCESS);
  });
  it("maps charge.failed/cancelled to FAILED", () => {
    expect(statusFromChapaEvent("charge.failed/cancelled")).toBe(PAYMENT_STATUS.FAILED);
  });
  it("maps charge.refunded to REFUNDED", () => {
    expect(statusFromChapaEvent("charge.refunded")).toBe(PAYMENT_STATUS.REFUNDED);
  });
  it("returns null for unknown events", () => {
    expect(statusFromChapaEvent("payment.initiated")).toBeNull();
    expect(statusFromChapaEvent("charge.failed")).toBeNull();
    expect(statusFromChapaEvent("")).toBeNull();
  });
});
