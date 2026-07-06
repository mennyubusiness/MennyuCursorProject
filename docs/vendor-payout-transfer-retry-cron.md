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

## Schedule (Hobby-compatible)

**Vercel Hobby** only allows cron jobs that run **once per day**. Sub-daily schedules (e.g. every 15–30 minutes) will **fail deployment** on Hobby.

`vercel.json` ships a **daily** cron entry:

- Path: `/api/internal/jobs/vendor-payout-transfer-retry?take=100`
- Schedule: `0 10 * * *` (10:00 UTC daily)

### Beta operations

- **Hobby (daily cron):** Automatic vendor retry runs once per day. Use **Retry eligible vendor transfers** and per-row retry/reconcile on `/admin/payout-transfers` between cron runs.
- **Higher frequency without code changes:** Use an **external scheduler** (GitHub Actions, cron-job.org, etc.) to `GET` or `POST` the same path with `Authorization: Bearer …` or `?secret=…` every 15–30 minutes.
- **Vercel Pro:** You may add additional or more frequent cron jobs in the Vercel dashboard if your plan allows sub-daily schedules.

## Disable safely

1. Remove the cron job from Vercel dashboard or delete the `crons` entry in `vercel.json`.
2. Unset both `INTERNAL_JOB_SECRET` and `CRON_SECRET` — the route returns **503** and does not run retries.

## Manual run

```bash
curl -H "Authorization: Bearer $INTERNAL_JOB_SECRET" \
  "https://<your-host>/api/internal/jobs/vendor-payout-transfer-retry?take=50"
```

## Logs

Watch for `[Vendor payout transfer retry cron]` in application logs.
