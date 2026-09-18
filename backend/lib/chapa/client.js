// Thin, dependency-free client for the official Chapa API.
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

/**
 * Safely masks secret keys so full credentials are never leaked in logs.
 * Example: CHASECK_TEST-abcdef123456 -> CHASECK_TEST-****3456
 */
export function maskKey(key) {
  if (!key || typeof key !== "string") return "(not configured)";
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "********";
  return `${trimmed.slice(0, 12)}****${trimmed.slice(-4)}`;
}

/**
 * Validates the Chapa secret key configuration against the configured environment.
 * Warns if CHAPA_ENV=test does not use a test key (starting with CHASECK_TEST-).
 */
export function validateChapaKeyConfig() {
  const key = process.env.CHAPA_SECRET_KEY?.trim();
  const env = (process.env.CHAPA_ENV || "test").trim().toLowerCase();

  if (!key) {
    return {
      ok: false,
      issue: "missing_key",
      message: "CHAPA_SECRET_KEY is missing from environment variables (.env).",
    };
  }

  if (env === "test" && !key.startsWith("CHASECK_TEST-")) {
    return {
      ok: false,
      issue: "malformed_test_key",
      message:
        `CHAPA_ENV is set to 'test', but CHAPA_SECRET_KEY does not start with the expected prefix 'CHASECK_TEST-'. ` +
        `Current key prefix: '${key.slice(0, Math.min(16, key.length))}' (masked: ${maskKey(key)}). ` +
        `Please copy your Test Secret Key from https://dashboard.chapa.co (Settings > API Keys).`,
    };
  }

  if (env === "live" && !key.startsWith("CHASECK-")) {
    return {
      ok: false,
      issue: "malformed_live_key",
      message:
        `CHAPA_ENV is set to 'live', but CHAPA_SECRET_KEY does not start with 'CHASECK-'. ` +
        `Current key format: ${maskKey(key)}.`,
    };
  }

  return { ok: true, env, maskedKey: maskKey(key) };
}

export function isChapaConfigured() {
  return Boolean(process.env.CHAPA_SECRET_KEY?.trim());
}

function bearerAuth() {
  const key = process.env.CHAPA_SECRET_KEY?.trim();
  if (!key) {
    throw new ChapaApiError(401, "CHAPA_SECRET_KEY is not configured", "chapa_not_configured");
  }
  return `Bearer ${key}`;
}

/**
 * Initialize a transaction and obtain the hosted checkout URL directly from Chapa.
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
  const env = (process.env.CHAPA_ENV || "test").trim().toLowerCase();
  console.log(`[Chapa] Initializing payment`);
  console.log(`[Chapa] tx_ref: ${txRef}`);
  console.log(`[Chapa] amount: ${amount}`);
  console.log(`[Chapa] environment: ${env}`);

  const validation = validateChapaKeyConfig();
  if (!validation.ok) {
    console.warn(`[Chapa] Configuration warning: ${validation.message}`);
  }

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
  console.log(`[Chapa] Initialize response: status=${response.status}`, JSON.stringify(body));

  if (!response.ok) {
    const errorMsg = body?.message || "Chapa could not initialize the payment";
    console.error(`[Chapa] Chapa API responded with HTTP ${response.status}: "${errorMsg}"`);
    throw new ChapaApiError(
      response.status,
      errorMsg,
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

  console.log(`[Chapa] Checkout URL received`);
  return { checkoutUrl, message: body?.message, raw: body };
}

/**
 * Verify a transaction server-side against Chapa's official verification API.
 * GET https://api.chapa.co/v1/transaction/verify/{tx_ref}
 */
export async function verifyTransaction(txRef) {
  console.log(`[Chapa] Verifying transaction: ${txRef}`);
  const response = await fetch(
    `${CHAPA_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: { Authorization: bearerAuth() },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const body = await response.json().catch(() => ({}));
  console.log(`[Chapa] Verification result: status=${response.status}`, JSON.stringify(body));

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