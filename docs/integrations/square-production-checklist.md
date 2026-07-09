# Square production readiness checklist

Use this checklist before enabling Square connect for real vendors on production.

## What Square connection does today

- OAuth connect + encrypted token storage
- Merchant profile + location discovery/selection
- Connection health checks
- Square catalog/menu import
- Square order injection (when `orderRoutingMode=square` + prerequisites met + `SQUARE_ROUTING_LIVE=true`)
- Square → Open Order status sync via `order.updated` webhooks (when `SQUARE_WEBHOOK_SIGNATURE_KEY` is set)

QA runbook: [square-order-injection-qa.md](./square-order-injection-qa.md)  
Status sync: [square-status-sync.md](./square-status-sync.md)

## What Square connection does **not** do

- No Square customer payments (Open Order checkout remains Stripe)
- No payout/allocation changes
- No Deliverect or manual routing changes

---

## Square Developer Dashboard

### Sandbox app

1. Create or open the **Sandbox** application in [Square Developer Dashboard](https://developer.squareup.com/apps).
2. OAuth → set redirect URL **exactly** (no trailing slash unless both sides use it):
   ```
   https://<your-host>/api/integrations/square/oauth/callback
   ```
3. Note **Sandbox Application ID** and **Sandbox Application Secret**.
4. Required OAuth scopes (requested by Open Order on normal connect — also enable these in the Square Developer Dashboard for your application):
   - `MERCHANT_PROFILE_READ`
   - `ITEMS_READ`
   - `ORDERS_READ`
   - `ORDERS_WRITE`
   - `PAYMENTS_READ`
   - `PAYMENTS_WRITE`

   **Reconnect required:** vendors connected before order-injection scopes were added only have catalog scopes until they reconnect and approve the expanded permissions.

   Debug-only minimal scopes (catalog connect diagnostics): `GET /api/vendor/{vendorId}/square/oauth/start?debug=1&minimal_scope=1`

### Production app

1. Create or open the **Production** application (separate from sandbox).
2. OAuth redirect URL must match production host exactly, e.g.:
   ```
   https://www.openorderco.com/api/integrations/square/oauth/callback
   ```
3. Use production Application ID + Secret only on production deployments.

---

## Vercel environment variables

Set on the correct Vercel scope (**Production** vs Preview).

| Variable | Production | Sandbox / Preview |
|----------|------------|-------------------|
| `ENABLE_SQUARE_INTEGRATION` | `true` | `true` (or omit in non-prod NODE_ENV) |
| `SQUARE_APPLICATION_ID` | Production app ID (`sq0idp-…`) | Sandbox app ID (`sandbox-sq0idp-…`) |
| `SQUARE_APPLICATION_SECRET` | Production secret | Sandbox secret |
| `SQUARE_ENVIRONMENT` | `production` | `sandbox` |
| `SQUARE_OAUTH_REDIRECT_URL` | Exact production callback URL | Exact preview/sandbox callback URL |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Min 32 chars (required) | Min 32 chars recommended |
| `SQUARE_ROUTING_LIVE` | `true` when live Square order injection is allowed | Usually `false` on preview unless testing injection |
| `AUTH_SECRET` | Required (OAuth state signing) | Required |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Webhook signature key from Square subscription | Optional until status sync enabled |
| `SQUARE_WEBHOOK_NOTIFICATION_URL` | `https://www.openorderco.com/api/webhooks/square` | Must match Square subscription URL exactly |

**Never** mix sandbox credentials with `SQUARE_ENVIRONMENT=production` or vice versa.

Open Order logs `environmentMismatchWarnings` when app ID prefix and `SQUARE_ENVIRONMENT` disagree.

---

## OAuth authorize hosts

| Environment | Authorize base |
|-------------|----------------|
| Sandbox | `https://connect.squareupsandbox.com/oauth2/authorize` |
| Production | `https://connect.squareup.com/oauth2/authorize` |

`session=false` is always sent so sellers choose the correct Square account in production.

---

## Sandbox testing quirk (internal)

Square sandbox OAuth may show a blank page unless the **Square Sandbox test account dashboard** is already open in another tab. This is a Square sandbox-session behavior and is **not** expected in production. Real vendors use normal Square login at `connect.squareup.com`.

---

## Deploy steps

1. Apply Prisma migrations (includes `IntegrationProviderCredential`, `IntegrationOAuthStateNonce`).
2. Set all env vars on Vercel Production.
3. Deploy latest commit; verify deployment hash matches `main`.
4. Debug (signed-in vendor manager):
   ```
   GET /api/vendor/{vendorId}/square/oauth/start?debug=1
   ```
   Expect `authorizeUrlHost`: `connect.squareup.com` (production) or `connect.squareupsandbox.com` (sandbox).
5. Connect Square from `/vendor/{vendorId}/integrations/square`.
6. Confirm callback lands on integration page with success or location selection.

---

## Production vendor flow

1. Vendor clicks **Connect Square**.
2. Square opens production login/authorization (`connect.squareup.com`).
3. Vendor signs in and grants permissions.
4. Square redirects to `SQUARE_OAUTH_REDIRECT_URL`.
5. Open Order validates signed state + nonce, exchanges code, stores encrypted tokens.
6. Open Order fetches merchant + locations.
7. Single active location → auto-selected; multiple → vendor chooses; zero active → clear error.
8. Connection shows business name, location, environment badge, last checked time.

---

## Rollback / disconnect

- Vendor: **Disconnect** on Square integration page (confirms copy about no checkout/payout impact).
- Ops: set `ENABLE_SQUARE_INTEGRATION=false` to hide connect UI in production.
- Removing env vars disables new connects; existing encrypted credentials remain until disconnect.

---

## Security notes

- OAuth `state` includes `vendorId`, `userId`, `exp`, `nonce`; signed with `AUTH_SECRET`.
- Nonces are persisted (`IntegrationOAuthStateNonce`) to prevent replay within TTL.
- Square authorization codes are single-use.
- Tokens stored AES-256-GCM in `IntegrationProviderCredential`; connection rows hold refs only.
- Reconnect deletes prior credential row **after** new token exchange succeeds.

---

## QA smoke tests

- [ ] Production OAuth URL host is `connect.squareup.com`
- [ ] Sandbox OAuth URL host is `connect.squareupsandbox.com`
- [ ] Redirect URI matches Square dashboard exactly
- [ ] Single location auto-connects
- [ ] Multiple locations require selection
- [ ] Zero active locations shows actionable error
- [ ] Disconnect removes credentials and deactivates connection
- [ ] Reconnect replaces credentials without orphan rows
- [ ] Invalid/expired OAuth state returns friendly error on integration page
- [ ] Reconnect test vendor after scope expansion shows `ORDERS_WRITE` / `PAYMENTS_WRITE` in admin diagnostics
- [ ] Manual/Deliverect vendor flows unchanged
