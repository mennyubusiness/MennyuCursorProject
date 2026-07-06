# Square integration readiness memo

## Environment variables (OAuth sprint)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SQUARE_APPLICATION_ID` | Yes (for OAuth) | Square application ID |
| `SQUARE_APPLICATION_SECRET` | Yes | OAuth client secret |
| `SQUARE_ENVIRONMENT` or `SQUARE_MODE` | Yes | `sandbox` or `production` |
| `SQUARE_OAUTH_REDIRECT_URL` | Yes | Must match Square dashboard — e.g. `https://<host>/api/integrations/square/oauth/callback` |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Yes in production | Min 32 chars — encrypts tokens in `IntegrationProviderCredential` |
| `ENABLE_SQUARE_INTEGRATION` | Yes in production | Must be `true` to show connect UI |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Later | Not used until webhook sprint |

Partial configuration logs warnings only — does not block app startup.

## Token storage

OAuth access/refresh tokens are stored encrypted in `IntegrationProviderCredential`.
`VendorIntegrationConnection.accessTokenRef` points to the credential row ID.
Raw tokens are never stored on the connection row.

## Recommended implementation order

1. **OAuth connection** — Populate `VendorIntegrationConnection` with Square merchant/location IDs and `accessTokenRef` (secret manager key, not raw token in DB).
2. **Menu import** — Square Catalog → `NormalizedMenu` → `ProviderEntityMapping` (Square uses mapping table from day one).
3. **Order injection** — Checkout success → `NormalizedProviderOrder` → `squareOrderAdapter.submitOrder()`.
4. **Status webhooks** — Square order events → `ProviderWebhookEvent` → `mapStatusWebhook` → existing vendor order status pipeline.

Defer: payments/refunds via Square (Open Order keeps Stripe for customer checkout in beta).

## Tables Square will use

| Table | Purpose |
|-------|---------|
| `VendorIntegrationConnection` | OAuth tokens by ref, location ID, capability JSON, health timestamps |
| `ProviderEntityMapping` | Catalog item/modifier/category ↔ internal menu IDs |
| `ProviderWebhookEvent` | Idempotent webhook log, sanitized payload |

Legacy Deliverect fields are **not** used for Square.

## Core services to converge into

| Concern | Converge into |
|---------|----------------|
| Payment success | Existing `recordPaymentAndAllocations` + post-payment routing (no Square-specific payout) |
| Order routing | `getOrderProviderAdapter("square").submitOrder()` from post-payment boundary |
| Status updates | Normalized status → existing `VendorOrder` fulfillment/routing update services |
| Menu publish | Normalized menu import job (extend `MenuImportJob` or parallel Square import job) |
| Readiness | `getVendorOrderProviderReadiness` / `getVendorMenuProviderReadiness` |

## What not to do

- No Square-specific payout or allocation system — keep Stripe Connect flow.
- No parallel menu model — use `MenuItem` / canonical menu + `ProviderEntityMapping`.
- No parallel order status lifecycle — map to existing `VendorFulfillmentStatus` / authority model.
- No Square logic in payment.service or payout services.

## Adapter entry points

- Register in `src/lib/integrations/provider-registry.ts` (replace placeholder).
- Implement `squareOrderAdapter` + `squareMenuAdapter` in `src/lib/integrations/adapters/square.adapter.ts`.
- Square webhook route: log via `logProviderWebhookEvent`, then process through adapter.
