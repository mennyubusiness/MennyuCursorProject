# Deliverect automatic reconciliation — Vercel Cron

Webhook remains the primary reconciliation path. This job runs **at most one** automatic GET fallback per overdue vendor order per episode (see `deliverectAutoRecheckAttemptedAt` on `VendorOrder`).

## Required environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `INTERNAL_JOB_SECRET` | One of these | Bearer token or `secret` query value (manual runs, scripts). |
| `CRON_SECRET` | One of these | Same semantics; [Vercel](https://vercel.com/docs/cron-jobs/manage-cron-jobs) can send `Authorization: Bearer <CRON_SECRET>` on scheduled cron invocations when this env var is set. |
| — | **Yes** | At least **one** of `INTERNAL_JOB_SECRET` or `CRON_SECRET` must be set or the endpoint returns **503**. |
| `DELIVERECT_GET_ORDER_URL_TEMPLATE` | No | Override Deliverect GET order URL if the default `{baseUrl}/orders/{orderId}` 404s. |

Generate a strong secret, e.g. `openssl rand -hex 32`.

## Auth model

The handler compares the incoming credential (timing-safe) against **`INTERNAL_JOB_SECRET` or `CRON_SECRET`** (first non-empty wins in code — use the **same value** in both if you set both, to avoid confusion).

Accepted:

1. `Authorization: Bearer <secret>` — matches either env var above.
2. `?secret=<secret>` on the URL — for GET crons or tools that cannot set headers.

**Do not** commit secrets in `vercel.json`; configure only in Vercel **Environment Variables**.

### Vercel Cron (recommended)

1. Add **`CRON_SECRET`** in Vercel Production (same random string you use for internal jobs, or duplicate `INTERNAL_JOB_SECRET` there).
2. Vercel typically injects **`Authorization: Bearer <CRON_SECRET>`** on cron requests when `CRON_SECRET` is set. No `secret` query param is required on the cron URL.
3. If the Bearer header is missing in your environment (rare; see [issues](https://github.com/vercel/vercel/issues/11303)), fall back: **Vercel → Cron Jobs** → edit the job URL to `...?take=40&secret=<your secret>` (same value as `CRON_SECRET` / `INTERNAL_JOB_SECRET`).

`vercel.json` cannot interpolate env into the path. Example path: `/api/internal/jobs/deliverect-reconciliation-fallback?take=40` (add `&secret=…` if needed).

If the request has **no** valid Bearer and **no** valid `secret` query, the route returns **401**.

## Schedule and batch size

**This repo does not ship a `crons` entry in `vercel.json`.** On **Vercel Hobby**, [cron is limited to at most once per day](https://vercel.com/docs/cron-jobs/usage-and-pricing); schedules like every 10 minutes **fail deployment** (“Hobby accounts are limited to daily cron jobs”). Use one of:

- **External scheduler** (e.g. GitHub Actions, cron-job.org) `GET`/`POST` the job URL with auth on your chosen interval.
- **Vercel Pro** if you want platform cron with sub-daily schedules, then add the job in the Vercel dashboard (or restore a `crons` entry that matches your plan limits).

Recommended when using a scheduler: interval on the order of **every 10 minutes** with a **25-minute** overdue threshold, and **`take=40`** (tune as needed).

## Disable cron safely

1. Remove scheduled triggers in your external scheduler **or** delete cron jobs in the Vercel dashboard (if any).  
2. Unset **both** `INTERNAL_JOB_SECRET` and `CRON_SECRET` — the endpoint returns **503** and does not run the job.

## Setup after merge

1. Add **`CRON_SECRET`** (recommended for scheduled runs) and/or **`INTERNAL_JOB_SECRET`** to **Production** — same value in both if you use both.  
2. Deploy.  
3. **Scheduler (Hobby):** configure an **external** cron (or GitHub Actions) to call `GET` or `POST`  
   `/api/internal/jobs/deliverect-reconciliation-fallback?take=40` with `Authorization: Bearer …` or `&secret=…`. On **Pro**, you may add a Vercel Cron job in the dashboard instead, respecting plan limits.  
4. Optional: set `DELIVERECT_GET_ORDER_URL_TEMPLATE` if GET order by id uses a non-default path.  
5. Watch **Logs** for `[Deliverect auto-reconciliation cron]` and `[Deliverect auto-reconciliation job]`.

## Plan limits

- **Hobby:** Cron may be limited or unavailable; check [Vercel Cron pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).  
- **Pro:** Cron jobs and longer `maxDuration` if you raise it on the route.

## Safety (recap)

- **Duplicate crons:** `updateMany` claim on `deliverectAutoRecheckAttemptedAt IS NULL` prevents double processing.  
- **Late webhook:** Row no longer matches eligibility → skipped.  
- **Manual recovery:** `manuallyRecoveredAt` blocks automatic fallback.
