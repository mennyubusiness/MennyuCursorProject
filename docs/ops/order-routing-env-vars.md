# Order routing environment variables

Server-side env vars that affect post-checkout order routing. Changes require **redeploy/restart** on Vercel.

## Square

| Variable | Values | Effect |
|----------|--------|--------|
| `ENABLE_SQUARE_INTEGRATION` | `true` / `false` | Enables Square connect UI and OAuth in production |
| `SQUARE_ROUTING_LIVE` | `true` / `false` | **Global kill switch** for live Square `CreateOrder` / `CreatePayment` API calls after Stripe checkout. Does **not** change vendor routing mode or auto-enable injection. |
| `SQUARE_ENVIRONMENT` | `sandbox` / `production` | Square OAuth + API hosts |
| `SQUARE_APPLICATION_ID` | Square app ID | OAuth client id |
| `SQUARE_APPLICATION_SECRET` | Secret | OAuth token exchange (server-only) |
| `SQUARE_OAUTH_REDIRECT_URL` | HTTPS URL | Must match Square Developer Dashboard exactly |

### Square OAuth scopes (application configuration)

Open Order requests these scopes on **normal** OAuth (not debug `minimal_scope`):

- `MERCHANT_PROFILE_READ`
- `ITEMS_READ`
- `ORDERS_READ`
- `ORDERS_WRITE`
- `PAYMENTS_READ`
- `PAYMENTS_WRITE`

**Existing vendors connected before order-injection scopes were added must reconnect Square** so Square issues a token with `ORDERS_WRITE` and `PAYMENTS_WRITE`.

Verify scopes on a deployment:

```http
GET /api/vendor/{vendorId}/square/oauth/start?debug=1
```

Debug-only minimal catalog scopes (diagnostics):

```http
GET /api/vendor/{vendorId}/square/oauth/start?debug=1&minimal_scope=1
```

Admin injection diagnostics: `/admin/vendors/{vendorId}` panel or `/admin/vendors/{vendorId}/square-routing-debug`.

Order-level Square debug: `/admin/orders/{orderId}/square-routing-debug`.

### Total mismatch reconciliation

| Variable | Default | Effect |
|----------|---------|--------|
| `SQUARE_TOTAL_MISMATCH_WARN_CENTS` | `1` | Admin warning when OO food+tax total differs from Square `order.total_money` |
| `SQUARE_TOTAL_MISMATCH_BLOCK_CENTS` | unset | Optional hard routing failure when mismatch ≥ threshold |

OO/Stripe remains source of truth for customer payment and payouts.

Sandbox QA runbook: `docs/integrations/square-order-injection-qa.md`.

### Square status sync webhooks

| Variable | Example | Effect |
|----------|---------|--------|
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | From Square webhook subscription | Enables `POST /api/webhooks/square` signature verification |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | `https://www.openorderco.com/api/webhooks/square` | Exact notification URL for HMAC verification (must match Square Dashboard) |

When unset, status sync is disabled (`503` on webhook); checkout, injection, Deliverect, and manual routing are unaffected.

Docs: `docs/integrations/square-status-sync.md`.

## Deliverect / manual

Unchanged by Square scope updates. See `ROUTING_MODE`, `DELIVERECT_*`, and Deliverect docs for Deliverect-specific routing.
