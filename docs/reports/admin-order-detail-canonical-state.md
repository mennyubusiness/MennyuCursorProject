# Admin order detail — canonical operational state

**Date:** 2026-07-16  
**Scope:** `/admin/orders/[orderId]` + Issues search inclusion + manual recovery lifecycle  
**Example order:** `#WH6S9AAL` (`cmrclzwdn0002sfyxwh6s9aal`)

## Root cause

Recovered completed orders stayed in **active Issues search** because successful admin manual recovery historically created (or left) an **OPEN** `VendorOrderIssue` of type `manual_recovery` after resolving `routing_failure`.

Active Issues inclusion used open `VendorOrderIssue` rows without excluding that artifact type. Separately, UI helpers derived “current” attention from raw `routingStatus === "failed"`, so the detail page still showed “Vendor did not receive order”, active Square failure banners, and retry affordances even after `manuallyRecoveredAt` + completed fulfillment.

## Canonical state model

Server-side `buildAdminOrderOperationalSummary` (`src/lib/admin-order-operational-summary.ts`) is the single source for:

- Header status + recovery detail
- Whether the Attention card renders (`needsAttention`)
- Vendor card status / receipt / retry flags
- Active vs resolved issue lists used by the page

Supporting gates:

- `getExceptionType` — no active exception after recovery / fulfillment progress
- `getAdminActionState` — terminal and recovered checked before retry/recovery actions
- `getOrderIdsWithOpenIssues` — excludes `NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES` (`manual_recovery`)

## Issue lifecycle changes

**Preferred model (implemented):** manual recovery is metadata + timeline event, not a new open issue.

On `POST .../manual-recovery`:

1. Transition fulfillment to `accepted` with recovery fields (`manuallyRecoveredAt` / `By` / `Notes`)
2. Resolve open `routing_failure` **and** any legacy open `manual_recovery` rows
3. Do **not** create a new open `manual_recovery` issue

UI treats leftover open `manual_recovery` rows as non-actionable (displayed as resolved history).

## UI consolidation

| Before | After |
| --- | --- |
| Duplicate Completed / summary chips | One header status + optional recovery detail |
| Always-on Attention (“Vendor did not receive…”) | Attention only when `operationalSummary.needsAttention` |
| Competing POS / kitchen / receipt rows | Vendor panel: current state + receipt + allocation; historical Square under “View resolved routing issue” |
| Notes & issues + separate resolution notes | **Activity & notes** (active → resolution → resolved collapsed → link to timeline) |
| Raw `routing failed · fulfillment completed` in operational UI | Raw routing/fulfillment only in collapsed technical details |
| Clawback copy for $0 refund | Clawback detail/warning only when `clawbackRequiredCents > 0` |

## Search behavior

Active Issues (`getOrderIdsWithOpenIssues`):

- Includes open/actionable `OrderIssue` statuses
- Includes `VendorOrderIssue` with `status === "OPEN"` **except** `manual_recovery`

Resolved / history tabs continue to surface resolved issue records (including resolved routing failure and repaired recovery artifacts).

## Data repair

Dry-run found **1** eligible stale open `manual_recovery` on the example order.

Repair applied:

| Field | Value |
| --- | --- |
| Issue id | `cmrcngpfc0009rmva3gxaekm6` |
| Order id | `cmrclzwdn0002sfyxwh6s9aal` |
| Result | `RESOLVED` by `cleanup-stale-manual-recovery` |
| Remaining open `manual_recovery` | **0** |

Script:

```bash
npm run issues:cleanup-stale-manual-recovery           # dry-run
npm run issues:cleanup-stale-manual-recovery:execute   # mutate
```

## Tests

```bash
npx vitest run \
  src/lib/admin-order-operational-summary.test.ts \
  src/lib/admin-order-health.test.ts \
  src/lib/admin-order-detail-layout.test.ts \
  src/app/api/admin/vendor-orders/[vendorOrderId]/manual-recovery/manual-recovery.route.test.ts \
  src/lib/admin-needs-attention-actions.test.ts \
  src/app/admin/(dashboard)/exceptions/IssuesWorkbench.test.ts
```

**Result:** 6 files, **45 passed**, 0 failed.

`npm run build` — **passed** (compile + typecheck of app; transient Prisma pool warnings during static generation only).

## Acceptance checklist

- [x] Completed manually recovered order not in active Issues (search exclusion + issue resolved)
- [x] Manual recovery does not create a new open issue
- [x] One authoritative current status from operational summary
- [x] Attention section only for current actionable problems
- [x] Historical Square failure collapsed as resolved context
- [x] Retry hidden after successful recovery / completion
- [x] Vendor receipt / fulfillment / header no longer contradict
- [x] Redundant status sections merged
- [x] Clawback-required copy gated on required cents / actual refund path
- [x] Technical raw state collapsed
- [x] Repair script + focused tests + production build
