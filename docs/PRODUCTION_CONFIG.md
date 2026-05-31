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
| `DELIVERECT_ENV=production` | Live Deliverect environment label (use `staging` + override for sandbox on preview hosts) |
| `DELIVERECT_WEBHOOK_AUTH_MODE=channel_link` | Default — HMAC uses each vendor's `deliverectChannelLinkId` (must be stored on `Vendor`) |
| `Vendor.deliverectChannelLinkId` | Per-vendor channel link id (DB) — required for webhook verification in channel_link mode |
| Deliverect API credentials | `DELIVERECT_CLIENT_ID`, `DELIVERECT_CLIENT_SECRET`, `DELIVERECT_API_URL`, etc. (see `DELIVERECT_SANDBOX.md`) |

### Deliverect webhook verification (channel_link — default)

Deliverect signs webhooks with **HMAC-SHA256** using the **channel link id** as the secret. Open Order:

1. Parses `channelLinkId` from the payload (or resolves it from a known order for prep-time callbacks).
2. Looks up `Vendor.deliverectChannelLinkId` — **unknown ids are rejected (403)** even if the signature matches a forged id.
3. Verifies the signature against the **known** channel link id before any order/menu mutation.

`DELIVERECT_WEBHOOK_SECRET` is **not required** in channel_link mode. Set `DELIVERECT_WEBHOOK_AUTH_MODE=partner_secret` only if Deliverect provides a separate global partner secret (legacy).

Channel-registration webhooks verify HMAC with the **new** channel link id from Deliverect before vendor matching (link id is not pre-stored).

## SMS / Twilio

| Mode | Variables |
|------|-----------|
| **Safe default (recommended until verified)** | `SMS_DRY_RUN=true` or `SMS_LOG_ONLY=true` — logs milestones without Twilio |
| **Live SMS** | `SMS_ENABLED=true`, `SMS_DRY_RUN=false`, plus `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` |

Startup **fails** if live SMS is enabled without Twilio credentials.

**Twilio note:** US A2P 10DLC / toll-free verification can block sends from unverified numbers or Messaging Services. Use dry-run until Twilio approves your sender; see [docs/SMS_SETUP.md](./SMS_SETUP.md).

## Email / password recovery

| Mode | Variables |
|------|-----------|
| **Safe default (local / staging)** | `EMAIL_DRY_RUN=true` — reset links logged to server console, not sent |
| **Live email** | `EMAIL_ENABLED=true`, `EMAIL_DRY_RUN=false`, plus `RESEND_API_KEY` and `EMAIL_FROM` |

Startup **fails** if live email is enabled without Resend credentials. Password recovery is email-only (not SMS). See [AUTH_UNIFIED.md](./AUTH_UNIFIED.md).

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

Live launch: `ROUTING_MODE=deliverect`, `DELIVERECT_ENV=production`, each live vendor has `deliverectChannelLinkId` set, `DELIVERECT_WEBHOOK_AUTH_MODE=channel_link` (default).

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
- [ ] `ROUTING_MODE=deliverect`, `DELIVERECT_ENV=production`, all live vendors have `deliverectChannelLinkId` configured
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
