/**
 * # NOTE: payments.js
 * Role: Payment Data Access Layer
 * Layer: Domain / Persistence
 * Description: Manages payment transactions, idempotency lookups, and status updates in PostgreSQL.
 */

import crypto from "node:crypto";
import { query } from "../postgres.js";
import { PAYMENT_STATUS } from "./status.js";

const id = () => crypto.randomUUID();

export function paymentDoc(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    paymentId: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    txRef: row.tx_ref,
    chapaTransactionId: row.chapa_transaction_id,
    amountCents: row.amount_cents,
    amount: row.amount_cents / 100,
    currency: row.currency,
    status: row.status,
    paymentMethod: row.payment_method,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    firstName: row.first_name,
    lastName: row.last_name,
    checkoutUrl: row.checkout_url,
    failureReason: row.failure_reason,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    paidAt: row.paid_at,
    verifiedAt: row.verified_at,
    webhookReceivedAt: row.webhook_received_at,
  };
}

export async function createPayment({
  orderId,
  userId,
  txRef,
  amountCents,
  currency = "ETB",
  customerEmail = "",
  customerPhone = "",
  firstName = "",
  lastName = "",
  metadata = {},
}) {
  const result = await query(
    `INSERT INTO payments (
      id, order_id, user_id, tx_ref, amount_cents, currency, status,
      customer_email, customer_phone, first_name, last_name, metadata
    ) VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7,$8,$9,$10,$11::jsonb)
    RETURNING *`,
    [
      id(),
      orderId,
      userId,
      txRef,
      Number(amountCents),
      currency,
      customerEmail,
      customerPhone,
      firstName,
      lastName,
      JSON.stringify(metadata),
    ],
  );
  return paymentDoc(result.rows[0]);
}

export async function findPaymentByTxRef(txRef) {
  const result = await query("SELECT * FROM payments WHERE tx_ref = $1", [txRef]);
  return paymentDoc(result.rows[0]);
}

export async function findPaymentById(paymentId) {
  const result = await query("SELECT * FROM payments WHERE id = $1", [paymentId]);
  return paymentDoc(result.rows[0]);
}

export async function findByOrderId(orderId) {
  const result = await query(
    "SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC",
    [orderId],
  );
  return result.rows.map(paymentDoc).filter(Boolean);
}

export async function findPendingForOrder(orderId) {
  const result = await query(
    `SELECT * FROM payments
     WHERE order_id = $1 AND status IN ('PENDING', 'PROCESSING')
     ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  return paymentDoc(result.rows[0]);
}

export async function updatePayment(id, updates) {
  const allowed = {
    chapaTransactionId: "chapa_transaction_id",
    status: "status",
    paymentMethod: "payment_method",
    checkoutUrl: "checkout_url",
    failureReason: "failure_reason",
    paidAt: "paid_at",
    verifiedAt: "verified_at",
    webhookReceivedAt: "webhook_received_at",
  };
  const entries = Object.entries(updates).filter(([key]) => key in allowed && updates[key] !== undefined);
  if (!entries.length) return findPaymentById(id);

  const values = entries.map(([, value]) => value);
  const assignments = entries
    .map(([key], index) => `${allowed[key]} = $${index + 1}`)
    .join(", ");
  const result = await query(
    `UPDATE payments SET ${assignments}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING *`,
    [...values, id],
  );
  return paymentDoc(result.rows[0]);
}

export async function setPaymentStatus(paymentId, status, extra = {}) {
  return updatePayment(paymentId, { status, ...extra });
}

export async function listPayments({
  userId = null,
  status = null,
  search = "",
  limit = 50,
  offset = 0,
}) {
  const conditions = [];
  const values = [];
  if (userId) {
    values.push(userId);
    conditions.push(`p.user_id = $${values.length}`);
  }
  if (status && status !== "ALL") {
    values.push(status);
    conditions.push(`p.status = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(
      `(p.tx_ref ILIKE $${values.length} OR p.id ILIKE $${values.length} OR p.customer_email ILIKE $${values.length} OR p.order_id ILIKE $${values.length} OR o.product_title ILIKE $${values.length})`,
    );
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  values.push(limit);
  values.push(offset);
  const result = await query(
    `SELECT p.*, o.product_title, o.product_id, o.order_type, o.currency AS order_currency,
            u.display_name AS user_display_name, u.username AS user_username, u.email AS user_email
     FROM payments p
     LEFT JOIN orders o ON o.id = p.order_id
     LEFT JOIN users u ON u.id = p.user_id
     ${where}
     ORDER BY p.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return result.rows.map((row) => ({
    ...paymentDoc(row),
    productTitle: row.product_title,
    productId: row.product_id,
    orderType: row.order_type,
    customer: row.user_display_name
      ? { displayName: row.user_display_name, username: row.user_username, email: row.user_email }
      : null,
  }));
}

export async function countPayments({ userId = null, status = null } = {}) {
  const conditions = [];
  const values = [];
  if (userId) {
    values.push(userId);
    conditions.push(`user_id = $${values.length}`);
  }
  if (status && status !== "ALL") {
    values.push(status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM payments ${where}`,
    values,
  );
  return result.rows[0]?.count ?? 0;
}

export { PAYMENT_STATUS };