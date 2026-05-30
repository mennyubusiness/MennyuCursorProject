# Production configuration

Fail-closed guards run at server startup when `NODE_ENV=production` (skipped during `next build` and local dev).

Implementation: `src/lib/production-config.ts` (called from `src/lib/env.ts`).

## Required for live production launch

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL |
| `AUTH_SECRET` | NextAuth session signing (min 32 chars) |
| `ORDER_ACCESS_SIGNING_SECRET` | Signed SMS/order status links (min 32 chars; may reuse `AUTH_SECRET` if ≥32) |
| `VENDOR_ACCESS_SIGNING_SECRET` | Vendor dashboard magic links (min 32 chars) |
| `PUBLIC_APP_URL` or `NEXTAUTH_URL` | Payment redirects, SMS links, Deliverect callbacks |
| `STRIPE_SECRET_KEY` | Live payments |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Checkout (must match live/test mode of secret key) |
| `ROUTING_MODE=deliverect` | Live POS submission (default `mock` skips Deliverect) |
| `DELIVERECT_ENV=production` | Required when `ROUTING_MODE=deliverect` |
| `DELIVERECT_WEBHOOK_SECRET` | Partner webhook HMAC when using production Deliverect webhooks |
| Deliverect API credentials | `DELIVERECT_CLIENT_ID`, `DELIVERECT_CLIENT_SECRET`, `DELIVERECT_API_URL`, etc. (see `DELIVERECT_SANDBOX.md`) |

## SMS / Twilio

| Mode | Variables |
|------|-----------|
| **Safe default (recommended until verified)** | `SMS_DRY_RUN=true` or `SMS_LOG_ONLY=true` — logs milestones without Twilio |
| **Live SMS** | `SMS_ENABLED=true`, `SMS_DRY_RUN=false`, plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` |

Startup **fails** if live SMS is enabled without Twilio credentials.

**Twilio note:** US A2P 10DLC / toll-free verification can block sends from unverified numbers or Messaging Services. Use dry-run until Twilio approves your sender; see [docs/SMS_SETUP.md](./SMS_SETUP.md).

## Admin access

| Method | Config |
|--------|--------|
| **Preferred** | Platform admin `User` + NextAuth session (`isPlatformAdmin`) — see [PLATFORM_ADMIN.md](./PLATFORM_ADMIN.md) |
| **Legacy bridge** | `ADMIN_SECRET` → `mennyu_admin` cookie via `POST /api/admin/access` |

`ADMIN_SECRET` is **not** required at startup (warning only). Set it if you still use the secret bridge or bootstrap route.

Avoid sharing admin secrets in URLs (`?admin=`); use cookie-based access where possible.

## Deliverect staging on preview hosts

Vercel preview builds often have `NODE_ENV=production`. For **sandbox** webhooks only:

- `DELIVERECT_ENV=staging` (channel-link HMAC)
- `ALLOW_DELIVERECT_STAGING_WEBHOOKS=true`
- Keep `ROUTING_MODE=mock` unless testing live submission

Live launch must use `DELIVERECT_ENV=production` + `DELIVERECT_WEBHOOK_SECRET` + `ROUTING_MODE=deliverect`.

## Intentional overrides (non-live)

| Variable | When |
|----------|------|
| `ALLOW_ROUTING_MODE_MOCK=true` | Demo/staging where orders must **not** reach POS |
| `ALLOW_DELIVERECT_STAGING_WEBHOOKS=true` | Sandbox webhooks on a production Node host |

## Internal jobs / Vercel Cron

| Variable | Purpose |
|----------|---------|
| `INTERNAL_JOB_SECRET` or `CRON_SECRET` | Protects `/api/internal/jobs/deliverect-reconciliation-fallback` |

Prefer `Authorization: Bearer <secret>`. Query `?secret=` is supported for manual/cron URLs but may appear in access logs.

## Rate limiting

In-memory rate limits (`docs/RATE_LIMITING.md`) are per server instance. Plan Redis/Upstash before horizontal scale.

Emergency disable: `RATE_LIMIT_DISABLED=1` (not recommended in production).

## Dev routes

`/api/dev/*` and `/dev/*` return 404 when `NODE_ENV=production`. Covered by source tests in `production-config.guards.test.ts`.

## Pre-launch checklist

- [ ] `PUBLIC_APP_URL` set to production https origin
- [ ] Stripe live keys + webhook endpoint configured (`STRIPE_WEBHOOK_SECRET`)
- [ ] Stripe webhook events subscribed (payment success, refunds, etc.)
- [ ] `ROUTING_MODE=deliverect`, `DELIVERECT_ENV=production`, `DELIVERECT_WEBHOOK_SECRET` set
- [ ] Deliverect channel links and menu IDs validated (see `DELIVERECT_SANDBOX.md`)
- [ ] `ORDER_ACCESS_SIGNING_SECRET` (or dedicated `AUTH_SECRET`) set and stable (rotating invalidates SMS links)
- [ ] `VENDOR_ACCESS_SIGNING_SECRET` set if using vendor magic links
- [ ] SMS: decide `SMS_DRY_RUN` vs live Twilio; verify sender in Twilio Console
- [ ] Platform admin user bootstrapped; retire `ADMIN_SECRET` in URLs when possible
- [ ] `INTERNAL_JOB_SECRET` / `CRON_SECRET` if using Deliverect reconciliation cron
- [ ] Rate limiting: accept in-memory caveat or plan shared store
- [ ] No `ALLOW_ROUTING_MODE_MOCK` on production launch unless intentional

## Environment reference

Copy from `.env.example` and fill production values in Vercel/hosting dashboard — never commit secrets.
