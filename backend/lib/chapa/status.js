/**
 * # NOTE: status.js
 * Role: Payment Status State Machine
 * Layer: Domain / Payments
 * Description: Defines normalized payment statuses and valid status transition rules.
 */

// Centralized payment / order status definitions used across the Chapa
// integration. Never use arbitrary status strings in the rest of the code.
export const PAYMENT_STATUS = Object.freeze({
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  REFUNDED: "REFUNDED",
});

export const ORDER_STATUS = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
});

export const CHAPA_EVENT = Object.freeze({
  // v1 events
  CHARGE_SUCCESS: "charge.success",
  CHARGE_REFUNDED: "charge.refunded",
  CHARGE_REVERSED: "charge.reversed",
  CHARGE_FAILED_CANCELLED: "charge.failed/cancelled",
  PAYOUT_SUCCESS: "payout.success",
  PAYOUT_FAILED_CANCELLED: "payout.failed/cancelled",
  // v2 events (api.chapa.global)
  PAYMENT_SUCCESS: "payment.success",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_CANCELLED: "payment.cancelled",
  PAYMENT_FULLY_REFUNDED: "payment.fully_refunded",
  PAYMENT_PARTIALLY_REFUNDED: "payment.partially_refunded",
});

export const CHAPA_STATUS = Object.freeze({
  SUCCESS: "success",
  FAILED: "failed",
  CANCELLED: "cancelled",
  PENDING: "pending",
  REFUNDED: "refunded",
  REVERSED: "reversed",
});

// Map a Chapa webhook event to our canonical payment status.
export function statusFromChapaEvent(event) {
  switch (event) {
    case CHAPA_EVENT.CHARGE_SUCCESS:
    case CHAPA_EVENT.PAYMENT_SUCCESS:
      return PAYMENT_STATUS.SUCCESS;
    case CHAPA_EVENT.CHARGE_REFUNDED:
    case CHAPA_EVENT.PAYOUT_SUCCESS:
    case CHAPA_EVENT.PAYMENT_FULLY_REFUNDED:
    case CHAPA_EVENT.PAYMENT_PARTIALLY_REFUNDED:
      return PAYMENT_STATUS.REFUNDED;
    case CHAPA_EVENT.CHARGE_FAILED_CANCELLED:
    case CHAPA_EVENT.PAYOUT_FAILED_CANCELLED:
    case CHAPA_EVENT.PAYMENT_FAILED:
    case CHAPA_EVENT.PAYMENT_CANCELLED:
      return PAYMENT_STATUS.FAILED;
    default:
      return null;
  }
}