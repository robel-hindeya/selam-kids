// Thin, dependency-free client for the official Chapa API.
// Supports:
//   - v2 (api.chapa.global) — keys like CHAPA_TEST_PRIV_… / CHAPA_LIVE_PRIV_…
//   - v1 (api.chapa.co)     — keys like CHASECK_TEST-… / CHASECK-…
// Docs: https://chapa.co/developers  |  https://developer.chapa.co
// The secret key must NEVER leave this module (read from process.env only).

const CHAPA_V1_BASE_URL = "https://api.chapa.co/v1";
const CHAPA_V2_BASE_URL = "https://api.chapa.global/v2";

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
 */
export function maskKey(key) {
  if (!key || typeof key !== "string") return "(not configured)";
  const trimmed = key.trim();
  if (trimmed.length <= 12) return "********";
  return `${trimmed.slice(0, 12)}****${trimmed.slice(-4)}`;
}

/**
 * Detects which Chapa API generation the configured secret key belongs to.
 * @returns {"v1" | "v2"}
 */
export function detectChapaApiVersion(key = process.env.CHAPA_SECRET_KEY) {
  const trimmed = String(key || "").trim();
  if (!trimmed) return "v2";
  if (trimmed.startsWith("CHASECK")) return "v1";
  if (trimmed.startsWith("CHAPA_")) return "v2";
  // Newer dashboard keys default to v2.
  return "v2";
}

/**
 * Validates the Chapa secret key configuration against the configured environment.
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

  const version = detectChapaApiVersion(key);

  if (env === "test") {
    const okV1 = key.startsWith("CHASECK_TEST-");
    const okV2 = key.startsWith("CHAPA_TEST_");
    if (!okV1 && !okV2) {
      return {
        ok: false,
        issue: "malformed_test_key",
        message:
          `CHAPA_ENV is set to 'test', but CHAPA_SECRET_KEY does not look like a test key. ` +
          `Expected CHASECK_TEST-… (v1) or CHAPA_TEST_… (v2). ` +
          `Current key prefix: '${key.slice(0, Math.min(16, key.length))}' (masked: ${maskKey(key)}). ` +
          `Copy your Test Secret Key from https://dashboard.chapa.co (Settings > API Keys).`,
      };
    }
  }

  if (env === "live") {
    const okV1 = key.startsWith("CHASECK-") && !key.startsWith("CHASECK_TEST-");
    const okV2 = key.startsWith("CHAPA_LIVE_");
    if (!okV1 && !okV2) {
      return {
        ok: false,
        issue: "malformed_live_key",
        message:
          `CHAPA_ENV is set to 'live', but CHAPA_SECRET_KEY does not look like a live key. ` +
          `Expected CHASECK-… (v1) or CHAPA_LIVE_… (v2). Current: ${maskKey(key)}.`,
      };
    }
  }

  return { ok: true, env, version, maskedKey: maskKey(key) };
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
 * Pulls the hosted-checkout payment id from a Chapa checkout URL.
 * e.g. https://checkout.chapa.global/test/payment/hosted/TESTI89728391f → TESTI89728391f
 */
export function extractChapaHostedId(checkoutUrl) {
  if (!checkoutUrl || typeof checkoutUrl !== "string") return null;
  try {
    const parts = new URL(checkoutUrl).pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || null;
  } catch {
    const match = checkoutUrl.match(/\/(?:hosted|payment)\/([A-Za-z0-9_-]+)\/?$/);
    return match?.[1] || null;
  }
}

function dropEmpty(payload) {
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined || payload[key] === "") delete payload[key];
  }
  return payload;
}

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Initialize a transaction and obtain the hosted checkout URL from Chapa.
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
  cancelUrl,
  customization,
  meta,
}) {
  const env = (process.env.CHAPA_ENV || "test").trim().toLowerCase();
  const version = detectChapaApiVersion();
  console.log(`[Chapa] Initializing payment (API ${version})`);
  console.log(`[Chapa] tx_ref: ${txRef}`);
  console.log(`[Chapa] amount: ${amount}`);
  console.log(`[Chapa] environment: ${env}`);

  const validation = validateChapaKeyConfig();
  if (!validation.ok) {
    console.warn(`[Chapa] Configuration warning: ${validation.message}`);
  }

  if (version === "v2") {
    return initializeTransactionV2({
      txRef,
      amount,
      email,
      firstName,
      lastName,
      phoneNumber,
      returnUrl,
      callbackUrl,
      cancelUrl,
      meta,
      customization,
    });
  }

  return initializeTransactionV1({
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
  });
}

async function initializeTransactionV1({
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
  const payload = dropEmpty({
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
  });

  const response = await fetch(`${CHAPA_V1_BASE_URL}/transaction/initialize`, {
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
  return {
    checkoutUrl,
    chapaTransactionId: extractChapaHostedId(checkoutUrl),
    message: body?.message,
    raw: body,
    apiVersion: "v1",
  };
}

async function initializeTransactionV2({
  txRef,
  amount,
  email,
  firstName,
  lastName,
  phoneNumber,
  returnUrl,
  callbackUrl,
  cancelUrl,
  meta,
  customization,
}) {
  // v2 amounts are integers in the smallest currency unit (cents / centimes).
  const amountCents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 100) {
    throw new ChapaApiError(
      400,
      "Payment amount must be greater than 1.00 in the configured currency.",
      "invalid_amount",
    );
  }

  const customer = dropEmpty({
    email,
    first_name: firstName || undefined,
    last_name: lastName || undefined,
    phone_number: phoneNumber || undefined,
  });

  const payload = dropEmpty({
    amount: amountCents,
    currency: process.env.CHAPA_CURRENCY || "ETB",
    customer,
    reference: txRef,
    // Browser redirect after pay / cancel. http://localhost is accepted here.
    success_url: returnUrl || undefined,
    cancel_url: cancelUrl || returnUrl || undefined,
    meta: {
      ...(meta || {}),
      ...(customization?.description ? { payment_reason: customization.description } : {}),
    },
  });

  // v2 callback_url must be https — skip on local http so initialize still works.
  if (callbackUrl && isHttpsUrl(callbackUrl)) {
    payload.callback_url = callbackUrl;
  } else if (callbackUrl) {
    console.warn(
      `[Chapa] Skipping callback_url (v2 requires https). Using success_url redirect instead: ${callbackUrl}`,
    );
  }

  const response = await fetch(`${CHAPA_V2_BASE_URL}/payments/hosted`, {
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
      body?.error?.code || body?.status || "chapa_initialize_failed",
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

  const chapaTransactionId =
    body?.data?.id ||
    body?.data?.reference ||
    body?.data?.chapa_reference ||
    extractChapaHostedId(checkoutUrl);

  console.log(`[Chapa] Checkout URL received (id=${chapaTransactionId || "unknown"})`);
  return {
    checkoutUrl,
    chapaTransactionId,
    message: body?.message,
    raw: body,
    apiVersion: "v2",
  };
}

/**
 * Verify a transaction server-side against Chapa's verification API.
 * For v2, prefer verifying with the hosted checkout id stored as chapaTransactionId.
 */
export async function verifyTransaction(txRef, { chapaTransactionId } = {}) {
  const version = detectChapaApiVersion();
  console.log(`[Chapa] Verifying transaction: ${txRef} (API ${version})`);

  if (version === "v2") {
    return verifyTransactionV2(txRef, chapaTransactionId);
  }
  return verifyTransactionV1(txRef);
}

async function verifyTransactionV1(txRef) {
  const response = await fetch(
    `${CHAPA_V1_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      method: "GET",
      headers: { Authorization: bearerAuth() },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const body = await response.json().catch(() => ({}));
  console.log(`[Chapa] Verification result: status=${response.status}`, JSON.stringify(body));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      notPaid: response.status === 404,
      data: body,
      apiVersion: "v1",
    };
  }

  const data = body?.data && typeof body.data === "object" ? { ...body.data } : { ...body };
  return { ok: true, status: response.status, data, apiVersion: "v1" };
}

async function verifyTransactionV2(txRef, chapaTransactionId) {
  const id = chapaTransactionId || txRef;
  const response = await fetch(
    `${CHAPA_V2_BASE_URL}/payments/${encodeURIComponent(id)}/verify`,
    {
      method: "GET",
      headers: { Authorization: bearerAuth() },
      signal: AbortSignal.timeout(15_000),
    },
  );

  const body = await response.json().catch(() => ({}));
  console.log(`[Chapa] Verification result: status=${response.status}`, JSON.stringify(body));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      notPaid: response.status === 404,
      data: body,
      apiVersion: "v2",
    };
  }

  const raw = body?.data && typeof body.data === "object" ? body.data : body;
  // Normalize to the shape the rest of the app expects (v1-compatible):
  // amount in major units, lowercase status, tx_ref / reference fields.
  const amountRaw = Number(raw?.amount);
  const amountMajor = Number.isFinite(amountRaw) ? amountRaw / 100 : amountRaw;

  const data = {
    ...raw,
    status: String(raw?.status || "").toLowerCase(),
    amount: amountMajor,
    currency: raw?.currency,
    tx_ref: raw?.merchant_reference || txRef,
    reference: raw?.chapa_reference || chapaTransactionId || id,
    method: raw?.payment_method || raw?.method || null,
    failure_reason: raw?.reason || raw?.failure_reason || null,
  };

  return { ok: true, status: response.status, data, apiVersion: "v2" };
}
