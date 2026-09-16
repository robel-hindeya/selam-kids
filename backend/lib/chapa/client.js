// Thin, dependency-free client for the Chapa API.
// Official docs: https://developer.chapa.co/integrations/accept-payments
//                https://developer.chapa.co/integrations/verify-payments
// Everything here calls Chapa server-side. The secret key must NEVER leave
// this module (it is read from process.env only).
const CHAPA_BASE_URL = "https://api.chapa.co/v1";

export class ChapaApiError extends Error {
  constructor(status, message, code, body) {
    super(message);
    this.name = "ChapaApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function isChapaConfigured() {
  return Boolean(process.env.CHAPA_SECRET_KEY);
}

function bearerAuth() {
  if (!process.env.CHAPA_SECRET_KEY) {
    throw new ChapaApiError(401, "CHAPA_SECRET_KEY is not configured", "chapa_not_configured");
  }
  return `Bearer ${process.env.CHAPA_SECRET_KEY}`;
}

/**
 * Initialize a transaction and obtain the hosted checkout URL.
 * POST https://api.chapa.co/v1/transaction/initialize
 */
export async function initializeTransaction({
  txRef,
  amount,
  email,
  firstName,
  lastName,
  phoneNumber,
  returnUrl,
  callbackUrl,
  customization,
  meta,
}) {
  const payload = {
    amount: String(Number(amount).toFixed(amount % 1 === 0 ? 0 : 2)),
    currency: process.env.CHAPA_CURRENCY || "ETB",
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    phone_number: phoneNumber || undefined,
    tx_ref: txRef,
    callback_url: callbackUrl || undefined,
    return_url: returnUrl || undefined,
    customization: customization || undefined,
    meta: meta || undefined,
  };
  // undefined keys are dropped — Chapa rejects unknown/empty values.
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined || payload[key] === "") delete payload[key];
  }

  const response = await fetch(`${CHAPA_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: bearerAuth(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ChapaApiError(
      response.status,
      body?.message || "Chapa could not initialize the payment",
      body?.status || "chapa_initialize_failed",
      body,
    );
  }

  const checkoutUrl = body?.data?.checkout_url || body?.checkout_url;
  if (!checkoutUrl) {
    throw new ChapaApiError(
      response.status,
      "Chapa did not return a checkout URL",
      "chapa_missing_checkout_url",
      body,
    );
  }

  return { checkoutUrl, message: body?.message, raw: body };
}

/**
 * Verify a transaction server-side.
 * GET https://api.chapa.co/v1/transaction/verify/{tx_ref}
 */
export async function verifyTransaction(txRef) {
  const response = await fetch(
    `${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: { Authorization: bearerAuth() },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    // 404 means "not found / not paid yet" — the payment simply isn't done.
    return {
      ok: false,
      status: response.status,
      notPaid: response.status === 404,
      data: body,
    };
  }

  // Documented verify payload may be wrapped under `data` or at the top level.
  const data = body?.data && typeof body.data === "object" ? { ...body.data } : { ...body };
  return { ok: true, status: response.status, data };
}