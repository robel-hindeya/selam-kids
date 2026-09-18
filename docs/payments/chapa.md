# Chapa Payment Integration (Selam Kids)

Digital magazine purchases are paid for in **Ethiopian Birr (ETB)** through
[Chapa](https://chapa.co). This document explains the architecture, data model,
environment variables, and lifecycle so the feature stays maintainable.

## Overview

```
 Kid clicks "Buy"          backend creates order + pending payment
        │                        (server-computed amount, tx_ref)
        │ POST /api/payments/chapa/create
        ▼
 backend calls Chapa initialize → checkout_url
        ▼
 Kid redirected to Chapa hosted checkout (card / Telebirr / CBE)
        ▼
 Chapa sends webhook (+ kid returns via return_url)
        ▼
 backend verifies tx_ref+amount+currency against Chapa verify API (server-side security)
        ▼
 payment marked SUCCESS → order marked PAID → magazine_sales + activity_logs (idempotent)
        ▼
 /payment/status/<txRef> shows result; item appears in "My Library"
```

Security properties:

- The **price, currency, order and amount are computed only on the server** from
  `magazines.price_cents`. The client can never set an amount.
- Fulfillment only happens after `verify` (not purely on the webhook) and only
  while `payment.status` is not already `SUCCESS` (DB-guarded idempotency).
- The webhook signature is checked against **either** Body Digest (`x-chapa-signature`)
  **or** Legacy Body Digest (`chapa-signature`); raw body is captured via
  `express.json({ verify })`.

## Environment variables

Add to `.env` (see `.env.example`):

| Variable | Purpose |
| --- | --- |
| `CHAPA_SECRET_KEY` | Server-only. v2 test: `CHAPA_TEST_PRIV_…` or v1 test: `CHASECK_TEST-…`. Never exposed to the browser. |
| `CHAPA_PUBLIC_KEY` | Reserved for future client-side use; currently unused by the app. |
| `CHAPA_WEBHOOK_SECRET` | Shared secret Chapa signs webhooks with (set it in the Chapa dashboard webhook form). |
| `CHAPA_ENV` | `test` or `live`. Controls which Chapa mode's keys are active. |
| `CHAPA_CURRENCY` | Optional override; defaults to `ETB`. |
| `APP_URL` / `FRONTEND_URL` | Single base URL (no spaces). Used to build `success_url` / `return_url` (`…/payment/status/<txRef>`). |

## After payment redirect

Chapa sends the browser to `success_url` / `return_url` → `/payment/status/<txRef>`.

If you previously saw **404 Not Found** after paying, common causes were:

1. `APP_URL` had two URLs concatenated with a space (invalid redirect).
2. `callback_url` pointed at the POST-only webhook route (`/api/webhooks/chapa`), so a browser GET returned Express 404.

The app now:

- Sanitizes `APP_URL` to the first URL token.
- Uses Chapa v2 `success_url` / `cancel_url` for browser redirects (and v1 `return_url`).
- Serves `GET /api/payments/chapa/callback` (and a GET safety net on the webhook path) that redirects to the status page.

## Webhook configuration (Chapa dashboard)

In the Chapa dashboard (Settings → Webhooks / API Keys):

- **Key**: `CHAPA_SECRET_KEY` (test or live).
- **Webhook URL**: `https://<your-public-api>/api/webhooks/chapa` (must be **https** for v2).
- **Webhook secret**: any long random string, then set the same value as
  `CHAPA_WEBHOOK_SECRET`.
- **Events**: at minimum `payment.success` (v2) or `charge.success` (v1).

Local webhook tip: `ngrok http 4000` and paste the https URL into the Chapa dashboard.
The browser return URL can stay on `http://localhost:8080` — only the webhook needs https.

## Data model

Added in `backend/lib/postgres.js` (created on first boot):

```sql
ALTER TABLE magazines ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 5000;

CREATE TABLE IF NOT EXISTS orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uuid       UUID NOT NULL REFERENCES users(uuid) ON DELETE CASCADE,
  product_type    TEXT NOT NULL DEFAULT 'magazine',
  product_id      TEXT NOT NULL,
  price_cents     INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ETB',
  status          TEXT NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders (user_uuid, status);

CREATE TABLE IF NOT EXISTS payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tx_ref           TEXT NOT NULL UNIQUE,
  amount           INTEGER NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'ETB',
  status           TEXT NOT NULL DEFAULT 'PENDING',
  payment_method   TEXT,
  chapa_tx_id      TEXT,
  failure_reason   TEXT,
  checkout_url     TEXT,
  paid_at          TIMESTAMPTZ,
  verified_at      TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_order_status ON payments (order_id, status);
```

Statuses (`backend/lib/chapa/status.js`):

- `payments.status`: `PENDING` → `PROCESSING` → `SUCCESS / FAILED / CANCELLED`
  (also `EXPIRED`, `REFUNDED`).
- `orders.status`: `PENDING` → `PAID`; stays `PENDING` on any payment failure so
  the user can retry.
- `orders.product_type` is always `magazine` today; the column is future-proof.

Retries: an **active** order (status `PENDING`) is reused per user+product, and a
pending payment on it is reused with its existing `checkout_url` — safe to call
"Pay" again without creating duplicates.

## API surface

- `POST /api/payments/chapa/create` `{ productId }` — kid: create/reuse order,
  open a pending payment, hit Chapa `initialize`, return
  `{ paymentId, txRef, checkoutUrl, amount, currency, orderId, productTitle }`.
- `GET /api/payments/chapa/verify/:txRef` — kid: check status; if the payment is
  still pending it calls the Chapa `verify` endpoint; on success it fulfills the
  order idempotently and returns `{ status, amount, fulfillmentVerified, mismatch, order }`.
- `GET /api/payments/:paymentId` — kid: payment detail (used by clients to look
  up status by UUID).
- `POST /api/webhooks/chapa` — Chapa → app. Validates signature, only ever acts
  on `charge.success` for a known txRef; verification/fulfillment reuses the
  same idempotent path as the verify route.
- `GET /api/admin/payments?status=&search=&limit=&offset=` — admin (see Admin
  Dashboard → Payments).

## Manual end-to-end test (test mode)

1. Set `CHAPA_ENV=test` and valid `CHASECK_TEST-…` keys + `CHAPA_WEBHOOK_SECRET`.
2. Run Postgres and `npm run dev`; make sure the tables are created.
3. Log in as a kid and open a magazine story (slug starts with `mag-`).
4. Click **Buy** → confirm the order summary → **Pay with Chapa**.
5. Complete (or cancel) in the Chapa test checkout. Test cards:
   - success: any Visa/Mastercard test number in Chapa docs;
   - failure: use the test "cancel/failed" option in Chapa test mode.
6. Back on `selam-kids…/payment/status/<txRef>` you should see the result;
   refresh "My Library" to see the magazine.
7. In Admin Dashboard → **Payments**, the row should show `SUCCESS` with `paid_at`.

Expected edge cases to re-check: double-click "Pay" (single pending payment
reused), webhook arriving before the return page verify (both paths are
idempotent), and mismatched amount returns `mismatch: true` without fulfillment.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `CHAPA_SECRET_KEY is not configured` | Missing env var; set `CHAPA_SECRET_KEY` (server-side). |
| 401/403 from Chapa initialize | Wrong key mode (test vs live) or invalid secret. |
| Webhook returns non-2xx | `CHAPA_WEBHOOK_SECRET` mismatch; or body route not yet mounted. |
| Payment stuck `PENDING` | Callback/return URL wrong (no `APP_URL`), or Chapa dashboard rules mismatch; re-verify endpoint manually. |
| Amount/currency mismatch shown | Price changed between order creation and payment — expected; fulfillment refused. |
| Tables missing | `backend/lib/postgres.js` should run migration at boot; check DB logs. |

## Rate limiting

`POST /api/payments/chapa/create` is protected by an in-memory rate limiter
(per IP+token bucket). It is process-local — for multi-instance deployment
replace `backend/lib/chapa/rate-limit.js` with the shared store (e.g. Redis).