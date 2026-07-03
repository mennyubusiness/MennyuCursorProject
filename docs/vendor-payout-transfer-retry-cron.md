# Vendor payout transfer retry — Vercel Cron

Retries failed and balance-blocked vendor Connect transfers using existing safety guards (re-evaluate blocked rows first, reconcile-before-send, balance checks).

## Required environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `INTERNAL_JOB_SECRET` | One of these | Bearer token or `secret` query value (manual runs, scripts). |
| `CRON_SECRET` | One of these | Same semantics; Vercel can send `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations. |
| — | **Yes** | At least **one** of `INTERNAL_JOB_SECRET` or `CRON_SECRET` must be set or the endpoint returns **503**. |

Generate a strong secret, e.g. `openssl rand -hex 32`.

## Auth model

Same as Deliverect reconciliation fallback — see [deliverect-vercel-cron.md](./deliverect-vercel-cron.md).

Accepted:

1. `Authorization: Bearer <secret>`
2. `?secret=<secret>` on the URL

**Do not** commit secrets in `vercel.json`.

## Schedule

`vercel.json` ships a cron entry every **20 minutes**:

- Path: `/api/internal/jobs/vendor-payout-transfer-retry?take=100`
- Schedule: `*/20 * * * *`

On **Vercel Hobby**, sub-daily cron may fail deployment. If so, remove the `crons` entry and use an external scheduler with the same path and auth.

## Disable safely

1. Remove the cron job from Vercel dashboard or delete the `crons` entry.
2. Unset both `INTERNAL_JOB_SECRET` and `CRON_SECRET` — the route returns **503** and does not run retries.

## Manual run

```bash
curl -H "Authorization: Bearer $INTERNAL_JOB_SECRET" \
  "https://<your-host>/api/internal/jobs/vendor-payout-transfer-retry?take=50"
```

## Logs

Watch for `[Vendor payout transfer retry cron]` in application logs.
