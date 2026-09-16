import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  generateTxRef,
  ETHIOPIAN_PHONE_PATTERN,
  isValidEthiopianPhone,
  normalizeAmountToCents,
  centsToAmount,
  amountsMatch,
  currenciesMatch,
  verifyWebhookSignature,
  isEmail,
} from "../../../backend/lib/chapa/validation.js";

describe("generateTxRef", () => {
  it("follows the HSC-ORDER-<8>-<6> format", () => {
    const tx = generateTxRef("abc12345-def");
    expect(tx).toMatch(/^HSC-ORDER-[A-Za-z0-9]{8}-[0-9A-F]{6}$/);
  });

  it("produces globally unique references", () => {
    const refs = new Set(Array.from({ length: 100 }, () => generateTxRef("id")));
    expect(refs.size).toBe(100);
  });

  it("uses XXXX when orderId is empty/invalid", () => {
    expect(generateTxRef("")).toMatch(/^HSC-ORDER-XXXX-[0-9A-F]{6}$/);
  });
});

describe("isValidEthiopianPhone", () => {
  it.each([
    ["0911223344", true],
    ["0722334455", true],
    ["09123456789", false], // 11 digits
    ["08123456789", false], // starts with 08
    ["1234567890", false],
    [null, false],
    ["", false],
  ])("validates %s → %s", (input, expected) => {
    expect(isValidEthiopianPhone(input)).toBe(expected);
  });

  it("accepts the regex pattern directly", () => {
    expect("0911223344").toMatch(ETHIOPIAN_PHONE_PATTERN);
  });
});

describe("money helpers", () => {
  it("normalizeAmountToCents converts ETB amount string to cents", () => {
    expect(normalizeAmountToCents("50")).toBe(5000);
    expect(normalizeAmountToCents(45.8)).toBe(4580);
    expect(normalizeAmountToCents("123.45")).toBe(12345);
  });

  it("centsToAmount converts cents to ETB amount", () => {
    expect(centsToAmount(5000)).toBe(50);
    expect(centsToAmount(4580)).toBe(45.8);
    expect(centsToAmount(12345)).toBe(123.45);
  });

  it("amountsMatch compares correctly", () => {
    expect(amountsMatch(5000, "50")).toBe(true);
    expect(amountsMatch(5000, 50)).toBe(true);
    expect(amountsMatch(5000, 49.99)).toBe(false);
    expect(amountsMatch(5000, undefined)).toBe(false);
  });

  it("currenciesMatch is case-insensitive", () => {
    expect(currenciesMatch("ETB", "etb")).toBe(true);
    expect(currenciesMatch("ETB", "ETB")).toBe(true);
    expect(currenciesMatch("ETB", "USD")).toBe(false);
    expect(currenciesMatch("ETB", "")).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const secret = "test-webhook-secret";
  const payload = JSON.stringify({ event: "charge.success", data: { id: 123 } });
  const body = Buffer.from(payload, "utf8");

  function signPayload(sec, bodyBuf) {
    return crypto.createHmac("sha256", sec).update(bodyBuf).digest("hex");
  }
  function signSecret(sec) {
    return crypto.createHmac("sha256", sec).update(sec).digest("hex");
  }

  it("accepts valid x-chapa-signature", () => {
    const sig = signPayload(secret, body);
    const valid = verifyWebhookSignature(body, { "x-chapa-signature": sig }, secret);
    expect(valid).toBe(true);
  });

  it("accepts valid chapa-signature (secret HMAC)", () => {
    const sig = signSecret(secret);
    const valid = verifyWebhookSignature(body, { "chapa-signature": sig }, secret);
    expect(valid).toBe(true);
  });

  it("rejects when no signature header is present", () => {
    expect(verifyWebhookSignature(body, {}, secret)).toBe(false);
  });

  it("rejects when both headers are present but wrong", () => {
    expect(
      verifyWebhookSignature(
        body,
        { "x-chapa-signature": "bad", "chapa-signature": "bad" },
        secret,
      ),
    ).toBe(false);
  });

  it("rejects when secret is empty", () => {
    const sig = signPayload(secret, body);
    expect(verifyWebhookSignature(body, { "x-chapa-signature": sig }, "")).toBe(false);
  });
});

describe("isEmail", () => {
  it.each([
    ["user@example.com", true],
    ["kid.name@domain.co", true],
    ["bad@", false],
    ["@nope.com", false],
    ["", false],
  ])("validates %s → %s", (input, expected) => {
    expect(isEmail(input)).toBe(expected);
  });
});
