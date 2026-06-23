# Pre-beta deployment and migration safety checklist

Use this before pointing real pods/vendors/customers at a staging or production Open Order deployment.

**Related docs:** [PRODUCTION_CONFIG.md](./PRODUCTION_CONFIG.md) · [SMS_SETUP.md](./SMS_SETUP.md) · [PLATFORM_ADMIN.md](./PLATFORM_ADMIN.md) · [deliverect-vercel-cron.md](./deliverect-vercel-cron.md) · [../DELIVERECT_SANDBOX.md](../DELIVERECT_SANDBOX.md)

---

## 1. Database migrations (protected)

### Apply (staging / production)

Run **after** backup and **before** or as part of the app deploy (migrations only; app can follow):

```bash
npx prisma migrate deploy
```

- Uses `DATABASE_URL` from the target environment.
- Applies pending SQL from `prisma/migrations/` in order.
- **Do not** use `prisma migrate dev`, `prisma db push`, or `prisma migrate reset` against shared staging/production.

### Verify status (safe, read-only)

```bash
npx prisma migrate status
```

Expect: **“Database schema is up to date!”** with no pending migrations.

Optional SQL confirmation for account-cart beta dependency (`20260604160000_cart_user_ownership`):

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Cart' AND column_name = 'userId';
```

Expect one row (`userId`, `text`). Index `Cart_userId_idx` should exist.

### Beta-critical migrations (verify applied)

| Migration | Why it matters |
|-----------|----------------|
| `20260531120000_customer_accounts_phase1` | Customer accounts, phone verification |
| `20260604160000_cart_user_ownership` | `Cart.userId` — account-owned carts, sign-in cart claim |
| `20260604130000_group_order_join_idempotency` | Group join stability |
| `20250330260000_vendor_order_deliverect_auto_recheck` | Deliverect reconciliation cron fields |
| `20260531150000_sms_twilio_infrastructure` | SMS opt-out / Twilio tables |
| `20260406190000_vendor_stripe_connect` | Vendor payouts (if using Connect) |

Full history: **53** migrations under `prisma/migrations/` (see `prisma migrate status` for ground truth).

### Post-migrate

```bash
npx prisma generate   # also runs on `npm install` via postinstall
```

**Seed:** `npm run db:seed` is for **local/dev** demo data only — not required for beta deploy and not a substitute for migrations.

---

## 2. Deploy order (recommended)

1. Confirm target branch/build passed CI (`npm test`, `npm run build`).
2. Set / verify Vercel (or host) **environment variables** for the target environment.
3. **Backup** production database (Supabase: point-in-time recovery or manual snapshot).
4. Run `npx prisma migrate deploy` against target `DATABASE_URL`.
5. Run `npx prisma migrate status` — must be clean.
6. Deploy application (Vercel deploy or `npm run build` + `npm start`).
7. Confirm server starts without `[production-config]` fatal errors (see logs).
8. Run **smoke tests** (section 8).

---

## 3. Environment variables — required for beta

Copy from `.env.example`; set in Vercel/host dashboard. **Never commit secrets.**

### Core (always)

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | PostgreSQL (Supabase or other); `sslmode=require` for Supabase |
| `NODE_ENV` | `production` on Vercel |
| `AUTH_SECRET` | Min 32 chars — customer/vendor sessions |
| `ORDER_ACCESS_SIGNING_SECRET` | Min 32 chars (or reuse `AUTH_SECRET` if ≥32) — SMS/order status links |
| `VENDOR_ACCESS_SIGNING_SECRET` | Min 32 chars — vendor dashboard magic links |
| `PUBLIC_APP_URL` | `https://…` production origin, no trailing slash |
| `NEXTAUTH_URL` | Same origin if `PUBLIC_APP_URL` unset |

### Payments (real checkout)

| Variable | Notes |
|----------|--------|
| `STRIPE_SECRET_KEY` | Match beta intent: `sk_test_…` for pilot, `sk_live_…` for live money |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Same mode as secret key |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks → signing secret for this endpoint |

### Deliverect (if POS routing enabled)

| Variable | Notes |
|----------|--------|
| `ROUTING_MODE` | `deliverect` for real POS submit; see disabled flags for mock |
| `DELIVERECT_ENV` | `production` for live; `staging` only with override flag |
| `DELIVERECT_API_URL`, `DELIVERECT_CLIENT_ID`, `DELIVERECT_CLIENT_SECRET` | API auth |
| `DELIVERECT_CHANNEL_NAME` | Order API path segment (case-sensitive) |
| Per-vendor DB | `Vendor.deliverectChannelLinkId`, menu `deliverectProductId` / modifier IDs |

### SMS (transactional)

| Variable | Notes |
|----------|--------|
| `SMS_MODE` | See section 5 — `log` until Twilio verified |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` | Required when `SMS_MODE=twilio` |

### Email (password recovery)

| Variable | Notes |
|----------|--------|
| `EMAIL_DRY_RUN` | `true` for beta without Resend |
| `RESEND_API_KEY`, `EMAIL_FROM` | When live email enabled |

### Ops / cron

| Variable | Notes |
|----------|--------|
| `INTERNAL_JOB_SECRET` or `CRON_SECRET` | Deliverect auto-reconciliation job |
| `ADMIN_SECRET` | Optional legacy admin bridge + platform-admin bootstrap |

### Supabase (optional)

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Brand logo uploads to Storage |

---

## 4. Flags — must stay **disabled** for beta (default-safe)

| Variable | Why |
|----------|-----|
| `ENABLE_CART_API_MUTATIONS` | REST cart mutations lack recovery; UI uses Server Actions |
| `DEBUG_ADD_TO_CART_TRACE` | Verbose cart logs; never in production |
| `DEBUG_DELIVERECT` | Verbose Deliverect HTTP logs |
| `ENABLE_ADMIN_TEST_TOOLS` | QA simulate routing failure, etc. |
| `ALLOW_ROUTING_MODE_MOCK` | Orders would not reach POS |
| `SHOW_DELIVERECT_STATUS_SIM_UI` | Sandbox status sim on admin order page |
| `RATE_LIMIT_DISABLED` | Emergency only |

Leave **unset** unless you have a documented exception.

---

## 5. Flags — enable when ready

| Variable | When |
|----------|------|
| `ROUTING_MODE=deliverect` | Beta pod uses real Deliverect POS for onboarded vendors |
| `DELIVERECT_ENV=production` | Live Deliverect partner environment |
| `SMS_MODE=twilio` | After A2P / Messaging Service verification (section 6) |
| `EMAIL_DRY_RUN=false` + Resend | When password reset email is required |
| `INTERNAL_JOB_SECRET` / `CRON_SECRET` | When running Deliverect reconciliation scheduler |
| `ALLOW_DELIVERECT_STAGING_WEBHOOKS=true` | **Only** sandbox Deliverect on a `NODE_ENV=production` preview host |
| `ALLOW_ROUTING_MODE_MOCK=true` | **Only** demo hosts with no POS |

---

## 6. Stripe webhook readiness

### Dashboard setup

1. Endpoint: `https://<PUBLIC_APP_URL>/api/webhooks/stripe`
2. Copy **signing secret** → `STRIPE_WEBHOOK_SECRET`
3. Subscribe at minimum:
   - `payment_intent.succeeded` — payment finalization
   - `charge.refunded` — refund sync
   - `refund.created`, `refund.updated` — refund ledger
   - `transfer.reversed` — Connect reversal handling (if using payouts)

### Verification

- [ ] Stripe CLI or Dashboard “Send test webhook” → `payment_intent.succeeded` → **200**
- [ ] Duplicate delivery → idempotent `received: true` (check `WebhookEvent` row)
- [ ] Wrong signing secret → **400** signature error
- [ ] Test order: pay → order moves off `pending_payment` without relying on client-only `/api/orders` confirm

---

## 7. Twilio / SMS readiness

### Before `SMS_MODE=twilio`

- [ ] Messaging Service created and **verified** (US: A2P 10DLC or toll-free verification)
- [ ] Inbound webhook: `https://<domain>/api/twilio/inbound-sms` (STOP/START/HELP)
- [ ] Status callback: `https://<domain>/api/twilio/sms-status` (or `TWILIO_STATUS_CALLBACK_URL`)
- [ ] `PUBLIC_APP_URL` set (callbacks derive from it)
- [ ] Migration `sms_twilio_infrastructure` applied (`SmsOptOut`, `SmsMessageLog`)

### Beta-safe default

```env
SMS_MODE=log
```

Records milestones in `SmsMessageLog` without Twilio API calls.

### Live SMS smoke

- [ ] Checkout SMS consent checkbox → transactional only
- [ ] Phone OTP → `PHONE_VERIFICATION` in `SmsMessageLog`
- [ ] Paid order → `ORDER_RECEIVED`
- [ ] Reply **STOP** → `SmsOptOut` row + no further sends

---

## 8. Deliverect sandbox vs live

### Sandbox / pilot (recommended first)

- [ ] `ROUTING_MODE=deliverect`
- [ ] `DELIVERECT_ENV=staging` + `ALLOW_DELIVERECT_STAGING_WEBHOOKS=true` (if host is Vercel production Node)
- [ ] One pilot vendor: `deliverectChannelLinkId`, product/modifier PLU IDs populated
- [ ] Webhook URL: `https://<domain>/api/webhooks/deliverect`
- [ ] Menu webhook (if used): `https://<domain>/api/webhooks/deliverect/menu`
- [ ] Test order → `routingStatus: sent`, `deliverectOrderId` set
- [ ] Status webhook or admin simulate → vendor order fulfillment updates
- [ ] Reconciliation: scheduler hits `/api/internal/jobs/deliverect-reconciliation-fallback` with Bearer secret (see [deliverect-vercel-cron.md](./deliverect-vercel-cron.md))

### Live production

- [ ] `DELIVERECT_ENV=production`
- [ ] **Unset** `ALLOW_DELIVERECT_STAGING_WEBHOOKS`
- [ ] Each live vendor: `deliverectChannelLinkId` matches Deliverect channel link
- [ ] `production-config` startup passes (no `ROUTING_MODE=mock` without override)

---

## 9. Test accounts checklist

### Platform admin

- [ ] Bootstrap via `POST /api/admin/platform-admin/bootstrap` with `ADMIN_SECRET` cookie ([PLATFORM_ADMIN.md](./PLATFORM_ADMIN.md))
- [ ] Or SQL: `UPDATE "User" SET "isPlatformAdmin" = true WHERE email = '…';` then sign in again
- [ ] Access `/admin` without `?admin=` in URL
- [ ] Verify payout admin routes require platform admin

### Pod operator

- [ ] User with `PodMembership` (owner/staff) for beta pod
- [ ] `/pod/<podId>/dashboard` loads
- [ ] Pod settings, vendor membership requests work

### Vendor

- [ ] User with `VendorMembership` for beta vendor
- [ ] Vendor dashboard + kitchen/orders
- [ ] Magic link grant (`VENDOR_ACCESS_SIGNING_SECRET` set in prod)
- [ ] If Deliverect: mapping page shows channel link + menu IDs

### Customer (guest)

- [ ] Browse pod → add to cart → checkout with test card
- [ ] Order status page + SMS link (if SMS enabled)

### Customer (account)

- [ ] Register / sign in
- [ ] `Cart.userId` migration applied — cart survives session rotation after sign-in
- [ ] Sign out → sign in → update/remove cart lines (mutation recovery)
- [ ] Account-owned solo cart checkout passes `createOrderFromCart` auth

### Group order (if beta scope includes)

- [ ] Host starts group → participant joins → both add items
- [ ] Fingerprint poll updates (`/api/cart/group-order-fingerprint`)
- [ ] Host checkout only

---

## 10. Smoke tests after deploy

### Cart & session

- [ ] `GET /api/cart?browsePodId=<podId>` returns quick-cart payload (Quick Cart drawer)
- [ ] Add / update / remove via vendor menu (Server Actions, not REST)
- [ ] `POST /api/cart` (line add) returns **410** `CART_API_MUTATIONS_DISABLED` (expected)
- [ ] `POST /api/cart/clear` works after checkout or quick-cart clear
- [ ] Signed-in customer: cart mutations on account-owned cart

### Checkout & payment

- [ ] `/cart` → checkout → Stripe test payment succeeds
- [ ] Webhook finalizes order (`paid` / routing started)
- [ ] Cart cleared client + server post-payment
- [ ] Re-open checkout with same cart fingerprint — pending order reuse behaves correctly

### Fulfillment

- [ ] Deliverect vendor: order routes to POS
- [ ] Manual vendor: kitchen can advance status
- [ ] Admin order detail shows vendor orders + issues

### Webhooks & jobs

- [ ] Stripe webhook delivery success in Dashboard
- [ ] Deliverect status webhook updates vendor order (or reconciliation job after stale window)
- [ ] No spike in `deliverect-webhook-incidents` / admin exceptions

### RBAC spot-check

- [ ] Non-admin cannot access `/admin` or `/api/admin/*`
- [ ] Vendor A cannot access Vendor B dashboard
- [ ] Pod member cannot access unrelated pod

---

## 11. Rollback / incident checklist

### Application rollback

1. Revert Vercel deployment to last known-good build (schema unchanged).
2. If env vars changed, restore previous values (especially Stripe/Deliverect mode).
3. Re-run smoke tests on reverted build.

### Migration incident (forward-only)

- **Do not** run `migrate reset` or drop tables on production.
- If a migration partially applied: use `prisma migrate resolve` per [Prisma migration best practices](https://www.prisma.io/docs/guides/migrate/production-troubleshooting).
- If app expects new column but migration not applied: **roll forward** with `migrate deploy`, not app rollback alone.
- Document incident: which migration, `migrate status` output, Supabase logs.

### Payment incidents

- [ ] Stripe Dashboard → Events / Webhooks for failed deliveries
- [ ] `WebhookEvent` rows with `processed: false` for `stripe` provider
- [ ] Stuck `pending_payment` orders — admin orders list + manual reconcile policy

### Deliverect incidents

- [ ] Admin → exceptions / stalled POS
- [ ] `routing_failure` issues — retry routing or manual recovery
- [ ] Disable scheduler: unset `CRON_SECRET` / `INTERNAL_JOB_SECRET` → job returns 503

### SMS incidents

- [ ] Set `SMS_MODE=log` or `disabled` to stop live sends
- [ ] Twilio Console → Messaging logs for error codes (30007, etc.)

---

## 12. CI / local verification before deploy

```bash
npm test
npm run build
npx prisma validate
npx prisma migrate status   # against staging URL, from secure runner
```

Key test suites hardened for beta (non-exhaustive):

- `cart.actions.auth.test.ts`, `cart-mutation-access-recovery.test.ts`
- `cart-api-auth.test.ts` (GET + disabled REST mutations)
- `checkout-api-auth.test.ts`, `order.service.pending-reuse.test.ts`
- `stripe-webhook-route.test.ts`
- `deliverect-webhook-route.test.ts`, reconciliation fallback tests
- `permissions.test.ts`, `admin-auth.test.ts`, `vendor-dashboard-auth.test.ts`

---

## 13. Documentation maintenance

| File | Action |
|------|--------|
| **This file** (`docs/PRE_BETA_DEPLOYMENT_CHECKLIST.md`) | Update when migrations or env flags change |
| `docs/PRODUCTION_CONFIG.md` | Keep in sync with `production-config.ts` guards |
| `docs/reports/beta-readiness-audit.md` | Historical; note which items are now closed |
| `.env.example` | Add new flags (`ENABLE_CART_API_MUTATIONS`, etc.) when introduced |
| `README.md` | Link to this checklist for deployers |

---

*Last aligned with schema/migrations as of June 2026 (includes `Cart.userId`, cart API mutation gate, account checkout hardening).*
