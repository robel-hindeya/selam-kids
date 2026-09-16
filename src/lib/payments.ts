export type PaymentStatus =
  "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED" | "EXPIRED" | "REFUNDED";

export interface CreateChapaPaymentResponse {
  paymentId: string;
  txRef: string;
  checkoutUrl: string;
  amount: number;
  currency: string;
  orderId: string;
  productTitle: string;
}

export interface PaymentOrderSummary {
  id: string;
  orderType: string;
  productId: string | null;
  productTitle: string;
  amount: number;
  status: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  txRef: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paymentMethod?: string | null;
  failureReason?: string | null;
  paidAt?: string | null;
  fulfillmentVerified: boolean;
  mismatch?: boolean;
  order?: PaymentOrderSummary | null;
}

export interface AdminPaymentItem {
  id: string;
  paymentId: string;
  orderId: string;
  txRef: string;
  chapaTransactionId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod?: string | null;
  customerEmail?: string | null;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  paidAt?: string | null;
  verifiedAt?: string | null;
  productTitle?: string | null;
  customer?: {
    displayName?: string;
    username?: string;
    email?: string;
  } | null;
}

export interface AdminPaymentListResponse {
  items: AdminPaymentItem[];
  total: number;
  limit: number;
  offset: number;
}

export async function createChapaPayment(productId: string): Promise<CreateChapaPaymentResponse> {
  const res = await fetch("/api/payments/chapa/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId }),
  });
  const data = (await res.json().catch(() => ({}))) as CreateChapaPaymentResponse & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    const message = data?.error || "Could not start the payment. Please try again.";
    throw new PaymentError(message, data?.code || "payment_create_failed", res.status);
  }
  return data;
}

export async function fetchPaymentStatus(txRef: string): Promise<PaymentStatusResponse> {
  const res = await fetch(`/api/payments/chapa/verify/${encodeURIComponent(txRef)}`, {
    credentials: "include",
  });
  const data = (await res.json().catch(() => ({}))) as PaymentStatusResponse & {
    error?: string;
    code?: string;
  };
  if (!res.ok) {
    throw new PaymentError(
      data?.error || "Could not verify the payment.",
      data?.code || "payment_verify_failed",
      res.status,
    );
  }
  return data;
}

export function formatBirr(amount: number, currency = "ETB"): string {
  const value = Number(amount || 0);
  if (currency.toUpperCase() === "ETB") {
    return `ETB ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export class PaymentError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "payment_error", status = 500) {
    super(message);
    this.name = "PaymentError";
    this.code = code;
    this.status = status;
  }
}
