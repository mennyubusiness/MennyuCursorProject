# Square Order Injection Sprint

**Date:** 2026-07-08  
**Status:** Implemented (MVP — one-way injection)

## Summary

Paid Open Order vendor orders can now be routed into Square as external/prepaid pickup orders when a vendor is explicitly configured for Square routing, has a healthy Square connection, a published Square-imported menu, and complete `ProviderEntityMapping` coverage for line items and modifiers.

Customer payment remains on Stripe. Square receives an `EXTERNAL` payment record so the order appears paid in Square POS without collecting from the customer. Open Order remains merchant of record.

---

## Files changed

| Area | Files |
|------|-------|
| Schema / migration | `prisma/schema.prisma`, `prisma/migrations/20260708140000_square_order_injection/` |
| Routing entry | `src/services/routing.service.ts` |
| Square order service | `src/services/square-order.service.ts` |
| Mapper + types | `src/lib/integrations/square/square-order-mapper.ts`, `square-order.types.ts` |
| Readiness gating | `src/lib/integrations/square/square-order-routing-readiness.ts` |
| Square API client | `src/lib/integrations/square/square-api.client.ts` |
| Env flag | `src/lib/env.ts` (`SQUARE_ROUTING_LIVE`) |
| Vendor routing mode | `src/lib/vendor-order-routing-mode.ts` |
| Admin enable toggle | `src/services/admin-vendor-rescue.service.ts`, `src/actions/admin-vendor.actions.ts`, `AdminVendorOrderRoutingSection.tsx` |
| Admin order observability | `src/lib/admin-order-detail-query.ts`, `admin-order-detail-ui.ts`, `AdminVendorOrderOperationalPanel.tsx`, `AdminDeliverectDiagnosticsPanel.tsx` |
| Retry availability | `src/lib/routing-availability.ts` |
| Tests | `square-order-mapper.test.ts`, `square-order-routing-readiness.test.ts`, `square-order.service.test.ts`, `routing.service.test.ts`, `vendor-order-routing-mode.test.ts` |

---

## Part 1 — Routing mode behavior

### Supported modes

- `manual_dashboard` — unchanged; paid orders stay in OO vendor queue
- `deliverect` — unchanged; Deliverect submit path
- `square` — new operational path when explicitly enabled

### Square injection gates (all required)

1. `Vendor.orderRoutingMode === "square"`
2. `Vendor.squareOrderRoutingEnabled === true` (admin toggle; **not** auto-enabled on menu publish)
3. Square connection healthy (OAuth token valid, integration active)
4. Selected Square location (`VendorIntegrationConnection.externalLocationId`)
5. Published live menu with `sourcePayloadKind === "square_catalog_v1"`
6. Per-order: every line item and modifier has an active `ProviderEntityMapping`
7. `SQUARE_ROUTING_LIVE=true` for live API calls (otherwise payload is built and stored without send)

Hook point: `submitVendorOrder()` in `routing.service.ts`, called post-Stripe payment success.

---

## Part 2 — Order mapping

`mapVendorOrderToSquareCreateOrder()` maps:

| OO entity | Mapping key | Square field |
|-----------|-------------|--------------|
| `MenuItem.deliverectProductId` (`sq:prod:*`) | `ProviderEntityMapping` (`menu_item`) | `line_items[].catalog_object_id` |
| `ModifierOption.deliverectModifierId` (`sq:modopt:*`) | `ProviderEntityMapping` (`modifier_option`) | `line_items[].modifiers[].catalog_object_id` |

Included in payload:

- Item quantity
- Selected modifiers
- Order notes + line special instructions
- Pickup fulfillment (`type: PICKUP`, `schedule_type: ASAP`)
- Pickup code in fulfillment note
- `source.name: "Open Order"`
- `location_id` from connection
- `reference_id` = vendor order id
- Idempotency key: `oo:sq:order:{vendorOrderId}`

### Missing mappings

- Routing blocked before API send
- `VendorOrder.routingStatus = failed`
- `routing_failure` issue created (HIGH)
- No silent item/modifier drops

---

## Part 3 — Square order creation

Flow in `submitVendorOrderToSquare()`:

1. Load vendor order + assert vendor-level readiness
2. Map payload via `ProviderEntityMapping`
3. `CreateOrder` using **vendor OAuth token** (`ensureSquareAccessToken`)
4. `CreatePayment` with `source_id: "EXTERNAL"` and idempotency `oo:sq:pay:{vendorOrderId}`

### Persisted audit fields (`VendorOrder`)

| Field | Purpose |
|-------|---------|
| `squareOrderId` | External Square order id |
| `squareSubmittedAt` | Successful submit timestamp |
| `squareAttempts` | Incremented on failure |
| `squareLastError` | Last error message |
| `lastSquarePayload` | Request audit (create order + payment) |
| `lastSquareResponse` | API responses |
| `routingStatus` | `sent` on success, `failed` on hard failure |

`ProviderEntityMapping` upserted for `vendor_order` → Square order id.

Idempotent: if `routingStatus=sent` and `squareOrderId` exists, submit is skipped.

---

## Part 4 — Payment / prepaid treatment

Square does **not** charge the customer.

After `CreateOrder`, Open Order records payment via Square Payments API:

```json
{
  "source_id": "EXTERNAL",
  "external_details": { "type": "OTHER", "source": "Open Order" },
  "amount_money": { "amount": <Square order total>, "currency": "USD" },
  "autocomplete": true
}
```

This marks the Square order as paid for POS/kitchen visibility. Stripe checkout, payouts, and pod payouts are unchanged.

**Known limitation:** External payment amount uses Square-calculated `order.total_money`, which may differ slightly from the OO/Stripe charge due to catalog pricing or tax rounding.

---

## Part 5 — Status handling (MVP)

One-way injection only:

- Success → `routingStatus = sent`
- Fulfillment remains OO-controlled (manual dashboard / vendor kitchen UI)
- No Square status webhooks in MVP

---

## Part 6 — Fallback behavior

On failure:

- Paid OO order remains visible in admin/vendor tools
- `routing_failure` issue surfaced
- Admin **Retry routing** available when `SQUARE_ROUTING_LIVE=true` (or Deliverect live)
- Manual recovery unchanged
- No automatic refund

---

## Part 7 — Admin / vendor observability

### Admin vendor rescue (`/admin/vendors/{id}`)

- Square order routing enable/disable toggle
- Prerequisites checklist via `loadSquareOrderRoutingReadiness()`

### Admin order detail

- Operational panel: Square provider label, Square order id, routing error
- Collapsible **Square routing details**: status, submit time, mapping issues, raw payload/response
- Existing retry routing + manual recovery actions

### Vendor dashboard

- Routing status labels via existing `vendorRoutingStatusLabel()` (no Square-specific POS lock like Deliverect)

---

## Part 8 — Tests / QA

| # | Scenario | Test file |
|---|----------|-----------|
| 1 | Square routing disabled unless explicitly enabled | `routing.service.test.ts`, `square-order-routing-readiness.test.ts` |
| 2 | Requires healthy connection | `square-order-routing-readiness.test.ts` |
| 3 | Requires active location | `square-order-routing-readiness.test.ts` |
| 4 | Requires Square-imported published menu | `square-order-routing-readiness.test.ts` |
| 5 | Item → Square variation ID | `square-order-mapper.test.ts` |
| 6 | Modifier → Square modifier ID | `square-order-mapper.test.ts` |
| 7 | Missing item mapping blocks routing | `square-order-mapper.test.ts` |
| 8 | Missing modifier mapping blocks routing | `square-order-mapper.test.ts` |
| 9 | Pickup fulfillment in payload | `square-order-mapper.test.ts` |
| 10 | Vendor OAuth token used | `square-order.service.test.ts` |
| 11 | Idempotency prevents duplicate orders | `square-order.service.test.ts` |
| 12 | API failure creates routing failure | `square-order.service.test.ts` |
| 13–14 | Deliverect/manual unchanged | `routing.service.test.ts` |
| 15 | Build passes | `npm run build` |

**74** Square/routing-related unit tests passing.

### Manual QA checklist

1. Connect Square sandbox vendor, import + publish menu
2. Admin: set routing mode `square`, enable Square order routing
3. Place test order with Stripe test card
4. Verify `VendorOrder.squareOrderId` populated in admin
5. Verify order visible in Square sandbox dashboard
6. Disable `SQUARE_ROUTING_LIVE` → confirm payload-only skip (no API call)
7. Remove a mapping → confirm `routing_failure` issue, no partial send

---

## Environment

| Variable | Purpose |
|----------|---------|
| `SQUARE_ROUTING_LIVE=true` | Enable live Square CreateOrder + EXTERNAL payment |
| Square OAuth vars | Existing Square connection (unchanged) |

---

## Known limitations

1. One-way injection — no Square webhook reconciliation
2. Square order total may differ from Stripe charge for EXTERNAL payment amount
3. `SQUARE_ROUTING_LIVE` must be set per environment for live sends
4. Square order routing must be **manually enabled** by admin after menu publish
5. Deliverect and manual routing paths untouched

---

## Rollout steps

1. Apply migration: `npx prisma migrate deploy`
2. Set `SQUARE_ROUTING_LIVE=true` in staging/production when ready
3. Per vendor: publish Square menu → set routing mode `square` → admin enable Square order routing
