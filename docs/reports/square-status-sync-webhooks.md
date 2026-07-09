# Square Status Sync Webhooks Sprint

**Date:** 2026-07-09  
**Status:** Complete

## Summary

Implemented one-way Square → Open Order fulfillment status sync using Square `order.updated` webhooks. Status changes made in Square Order Manager, POS, or Dashboard update the matching `VendorOrder` in Open Order. Checkout, payouts, Square order injection, Deliverect routing, and manual/tablet routing are unchanged.

---

## Files changed

| Area | Files |
|------|-------|
| Webhook route | `src/app/api/webhooks/square/route.ts`, `square-webhook-route.test.ts` |
| Signature verify | `src/lib/integrations/square/square-webhook-verify.ts`, `.test.ts` |
| Payload parsing | `src/lib/integrations/square/square-webhook-payload.ts` |
| Status mapper | `src/lib/integrations/square/square-status-mapper.ts`, `.test.ts` |
| Sync service | `src/services/square-status-sync.service.ts`, `.test.ts` |
| Square API | `src/lib/integrations/square/square-api.client.ts` (`fetchSquareOrder`) |
| Types / audit | `src/lib/integrations/square/square-order.types.ts`, `square-order-audit.ts` |
| Schema | `prisma/schema.prisma`, migration `20260709120000_square_webhook_status_source` |
| Status instrumentation | `src/services/vendor-order-status-instrumentation.ts`, `src/domain/status-authority.ts` |
| Admin UI | `AdminDeliverectDiagnosticsPanel.tsx`, `AdminSquareStatusSync.tsx` |
| Admin manual sync | `src/app/api/admin/vendor-orders/[vendorOrderId]/square-status-sync/route.ts` |
| Vendor UI | `VendorOrderDetailPanel.tsx`, `vendor-orders-board-data.ts`, `deliverect-vendor-order-authority.ts` |
| Env | `src/lib/env.ts` (`SQUARE_WEBHOOK_NOTIFICATION_URL`) |
| Docs | `docs/integrations/square-status-sync.md`, `square-production-checklist.md`, `docs/ops/order-routing-env-vars.md` |

---

## Webhook endpoint

`POST /api/webhooks/square`

- Verifies `x-square-hmacsha256-signature` using `SQUARE_WEBHOOK_SIGNATURE_KEY` + `SQUARE_WEBHOOK_NOTIFICATION_URL`
- Rejects invalid signatures (`403`, logs `failed_signature`)
- Returns `503` when webhook env not configured (does not affect checkout or other routing)
- Primary event: `order.updated`
- Ignores duplicate `event_id` via `ProviderWebhookEvent` unique constraint

---

## Event persistence / idempotency

Uses `ProviderWebhookEvent` (`provider=square`):

| Field | Purpose |
|-------|---------|
| `externalEventId` | Square `event_id` — duplicate-safe |
| `externalObjectId` | Square order id |
| `eventType` | e.g. `order.updated` |
| `processingStatus` | `received` / `processed` / `ignored` / `failed` |
| `errorCode` | `ignored_no_match`, `ignored_non_order_update`, `failed_signature`, `failed_processing`, etc. |
| `relatedVendorOrderId` | Linked after match |

Vendor order audit: `lastSquarePayload.statusSync` (`SquareWebhookLastApplyRecord`).

---

## Status mapping

| Square pickup fulfillment | OO fulfillment | OO routing (when progressing) |
|---------------------------|----------------|-------------------------------|
| `PROPOSED` | `accepted` | `confirmed` |
| `RESERVED` | `preparing` | `confirmed` |
| `PREPARED` | `ready` | `confirmed` |
| `COMPLETED` | `completed` | `confirmed` |
| `CANCELED` / `FAILED` | `cancelled` | `confirmed` |

Monotonic merge: terminal OO `completed` / `cancelled` do not regress. Fetches latest order via `GET /v2/orders/{id}` before applying.

---

## OO status update path

1. Webhook or admin manual sync
2. `syncSquareOrderStatusBySquareOrderId` / `applySquareOrderStatusSync`
3. Vendor OAuth `fetchSquareOrder`
4. `mapSquareOrderSnapshotToVendorStatus` + `mergeSquareMappedIntoVendorOrder`
5. `applyVendorOrderStatusWithMeta` (`statusSource: square_webhook`, `historySource: square`)
6. `evaluateCustomerOrderMilestones` → preparing/ready SMS (existing idempotency keys)

---

## SMS / idempotency

Square updates flow through the same `applyVendorOrderStatusWithMeta` → `evaluateCustomerOrderMilestones` path as vendor dashboard actions. Duplicate webhooks produce `noop_same_status` and do not re-send SMS.

---

## Admin observability

Admin order detail → Square routing details:

- Status sync configured (yes/no)
- Last synced at, fulfillment/order state, last error
- **Sync status from Square now** button
- Collapsible payload/response audit (unchanged)

---

## Vendor dashboard

Square-routed orders with `squareOrderId` show:

> “This order is routed to Square. Status updates from Square will update Open Order.”

OO kitchen action buttons remain available (MVP — no hard lock). Deliverect POS-lock copy is not shown for Square vendors.

---

## Tests / QA

| # | Scenario | Result |
|---|----------|--------|
| 1 | Signature verification passes | ✅ |
| 2 | Invalid signature rejected | ✅ |
| 3 | Duplicate event ID ignored | ✅ |
| 4 | No matching `squareOrderId` → ignored | ✅ |
| 5 | Matching order fetches Square order | ✅ |
| 6 | `PREPARED` → OO `ready` | ✅ |
| 7 | `COMPLETED` → OO `completed` | ✅ |
| 8 | Cancellation maps to `cancelled` | ✅ |
| 9 | Terminal statuses do not regress | ✅ |
| 10 | Admin manual sync uses same mapper | ✅ |
| 11 | Missing signature key → 503, no checkout impact | ✅ |
| 12 | Deliverect/manual routing tests unchanged | ✅ |
| 13 | `npm run build` | ✅ |

**31** new/related unit tests passing in Square status sync suite.

---

## Known limitations

1. One-way sync only — OO status edits do not push to Square
2. Only `order.updated` in this sprint (not `order.fulfillment.updated` or `payment.updated`)
3. Webhook URL must match Square subscription exactly for signature verification
4. Requires prior Square injection (`squareOrderId` on `VendorOrder`)
5. Vendor kitchen buttons not disabled — staff can still update in OO (possible dual-system edits)

---

## Rollout

1. `npx prisma migrate deploy`
2. Square Developer Dashboard → webhook subscription → `order.updated` → `https://www.openorderco.com/api/webhooks/square`
3. Set `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` in production
4. Sandbox QA per `docs/integrations/square-status-sync.md`
