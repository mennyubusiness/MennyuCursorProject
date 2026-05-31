# Rate limiting (v1)

Lightweight fixed-window rate limits protect sensitive public routes from brute-force and spam abuse.

## Storage model

**Current implementation: in-memory (per Node.js process).**

- Counters live in a module-level `Map` (`src/lib/rate-limit.ts`).
- Limits reset on deploy/restart and are **not shared** across multiple server instances.
- Suitable for single-instance or low-traffic launch; **not sufficient alone for horizontally scaled production**.

### Future upgrade path

When Redis, Upstash, or Vercel KV is available, replace the store behind `consumeRateLimit()` with a shared backend. No paid dependency was added in v1.

## Environment variables

| Variable | Effect |
|----------|--------|
| `RATE_LIMIT_DISABLED=1` | Disables all rate limits (emergency override). |
| `RATE_LIMIT_TEST=1` | Enables limits during Vitest (normally off in `NODE_ENV=test`). |

## Response shape

When limited, routes return **HTTP 429** with:

```json
{ "error": "Too many attempts. Please try again later.", "code": "RATE_LIMITED" }
```

`Retry-After` header is set when applicable (seconds until window reset).

## Limits (starting points)

| Surface | Dimensions | Limit |
|---------|------------|-------|
| OTP send | phone + IP | 3 / phone / 10 min; 10 / IP / hour |
| OTP verify | phone + IP | 5 / phone / 10 min; 20 / IP / 10 min |
| Login (NextAuth POST) | IP + email (when present) | 10 / 15 min each |
| Admin secret access | IP | 5 / 15 min |
| Platform admin bootstrap | IP | 5 / 15 min |
| Checkout submit | session + IP | 10 / session / 10 min; 20 / IP / 10 min |
| Order payment confirm (`POST /api/orders`) | session | 10 / 10 min |
| Order status poll | order + session/IP | 120 / 10 min |
| SMS order access bootstrap | order + IP | 30 / 10 min |
| Support issue submit | order + IP | 5 / hour |
| Register (server action) | IP | 10 / hour |
| Password reset request (server action) | email + IP | 3 / email / hour; 10 / IP / hour |
| Password reset submit (server action) | IP | 10 / 15 min |
| Group order join (server action) | IP + session id | 10 / 10 min each |

OTP verify also enforces per-code attempt limits in the database (`customer-phone-otp.service.ts`).

## Routes intentionally not rate-limited

| Route | Reason |
|-------|--------|
| Stripe webhooks (`/api/webhooks/stripe`) | Legitimate provider retries must not be blocked. |
| Deliverect webhooks | Same as above. |
| Authenticated vendor/admin operational APIs | Already gated by session/membership checks; separate abuse surface. |
| Cart read/mutations | Lower abuse risk for v1; checkout is limited instead. |
| `POST /api/orders/set-phone` | Deprecated 410 stub. |
| Dev simulation routes | Local/dev tooling only. |

## Implementation files

- `src/lib/rate-limit.ts` — core store + policy constants
- `src/lib/rate-limit-http.ts` — IP extraction + `429` JSON helper
- Route wiring in OTP, auth, admin access, checkout, orders, issues, access bootstrap
- Server actions: `register.actions.ts`, `password-reset.actions.ts`, `group-order.actions.ts`

## Security notes

- Rate limit responses use generic copy (no account/phone existence leaks).
- OTP codes are never logged.
- Limits complement — do not replace — existing auth and ownership checks.
