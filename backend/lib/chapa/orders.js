import crypto from "node:crypto";
import { query } from "../postgres.js";

const id = () => crypto.randomUUID();

export function orderDoc(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    userId: row.user_id,
    orderType: row.order_type,
    productId: row.product_id,
    productTitle: row.product_title,
    amountCents: row.amount_cents,
    amount: row.amount_cents / 100,
    currency: row.currency,
    status: row.status,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createOrder({
  userId,
  orderType = "magazine_purchase",
  productId,
  productTitle,
  amountCents,
  currency = "ETB",
  metadata = {},
}) {
  if (!Number.isInteger(Number(amountCents)) || Number(amountCents) <= 0) {
    throw new Error("Invalid order amount");
  }
  const result = await query(
    `INSERT INTO orders (id, user_id, order_type, product_id, product_title, amount_cents, currency, status, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8::jsonb)
     RETURNING *`,
    [id(), userId, orderType, productId, productTitle, Number(amountCents), currency, JSON.stringify(metadata)],
  );
  return orderDoc(result.rows[0]);
}

export async function findOrderById(orderId) {
  const result = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
  return orderDoc(result.rows[0]);
}

export async function findActiveOrderForProduct(userId, productId) {
  const result = await query(
    `SELECT * FROM orders
     WHERE user_id = $1 AND product_id = $2 AND status NOT IN ('PAID', 'CANCELLED')
     ORDER BY created_at DESC LIMIT 1`,
    [userId, productId],
  );
  return orderDoc(result.rows[0]);
}