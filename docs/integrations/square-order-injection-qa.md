# Square order injection — sandbox QA runbook

**Last updated:** 2026-07-08

Use this checklist before broader beta rollout of Square order injection.

## 1. Confirm environment

| Variable | Expected (sandbox QA) |
|----------|------------------------|
| `ENABLE_SQUARE_INTEGRATION` | `true` |
| `SQUARE_ROUTING_LIVE` | `true` |
| `SQUARE_ENVIRONMENT` | `sandbox` |
| `SQUARE_APPLICATION_ID` / `SQUARE_APPLICATION_SECRET` | Sandbox app credentials |
| `SQUARE_OAUTH_REDIRECT_URL` | Matches Square Developer Dashboard |

Square OAuth application must request:

- `MERCHANT_PROFILE_READ`
- `ITEMS_READ`
- `ORDERS_READ`
- `ORDERS_WRITE`
- `PAYMENTS_READ`
- `PAYMENTS_WRITE`

Optional reconciliation tuning:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SQUARE_TOTAL_MISMATCH_WARN_CENTS` | `1` | Admin warning when \|OO food+tax − Square total\| ≥ threshold |
| `SQUARE_TOTAL_MISMATCH_BLOCK_CENTS` | unset | Optional hard block when mismatch ≥ threshold |

Admin diagnostics:

- Vendor: `/admin/vendors/{vendorId}/square-routing-debug`
- Order: `/admin/orders/{orderId}/square-routing-debug`

## 2. Connect Square sandbox vendor

1. Open `/vendor/{vendorId}/integrations/square`.
2. Complete OAuth and select a sandbox location.
3. Confirm admin vendor diagnostics show connection healthy and required scopes present.

## 3. Import Square catalog

1. Open `/vendor/{vendorId}/menu/imports`.
2. Run Square catalog import.
3. Confirm mappings are created for items/modifiers used in QA orders.

## 4. Preview and publish Square menu

1. Open imported menu draft preview.
2. Publish menu to make it customer-orderable.
3. Confirm `hasSquarePublishedMenu` / menu readiness passes in admin diagnostics.

## 5. Set routing mode

1. Admin vendor detail → Order routing → **Square**.
2. Save routing mode.
3. Confirm `orderRoutingMode=square` (no separate enable toggle).

## 6. Confirm public orderability

1. Open public pod vendor page.
2. Confirm menu loads and checkout is available during open hours.
3. No provider diagnostics should appear on customer surfaces.

## 7. Place test customer orders

Run each scenario in sandbox:

| Scenario | Verify |
|----------|--------|
| Single item | Line item name/qty in Square |
| Multi-quantity item | Quantity preserved |
| Item with modifier | Modifier mapping applied |
| Multi-item order | All lines present |
| Customer/item notes | Note appears on Square pickup fulfillment when supported |

## 8. Confirm Open Order post-payment state

For each paid order, in admin order detail:

- Stripe payment succeeded (checkout unchanged)
- `VendorOrder.routingStatus` → `sent` on success, `failed` + routing issue on failure
- `squareOrderId` stored
- `lastSquarePayload` / `lastSquareResponse` audit JSON present
- Square payment id/status in audit when payment succeeds
- Total comparison block when OO vs Square totals differ
- No silent fallback to manual/Deliverect

## 9. Confirm Square sandbox order

In Square Dashboard for the sandbox location:

- Order appears with Open Order reference
- Pickup fulfillment present
- EXTERNAL / prepaid payment recorded
- Source shows Open Order
- Item names/modifiers look correct
- Vendor is **not** prompted to collect payment again

## 10. Confirm payouts unchanged

- Stripe charge remains source of truth for customer payment
- Vendor payout transfers unchanged
- Square injection is visibility/POS routing only

## Retry QA

1. Simulate CreateOrder failure → admin **Retry routing** → single Square order via idempotency key `oo:sq:order:{vendorOrderId}`.
2. Simulate CreateOrder success + payment failure → `squareOrderId` persisted → retry runs payment only (`oo:sq:pay:{vendorOrderId}`).
3. Confirm duplicate retry does not create a second Square order.

## Failure-mode spot checks

| Case | Expected |
|------|----------|
| Missing `ORDERS_WRITE` / `PAYMENTS_WRITE` | Clear reconnect guidance; retry blocked until reconnect |
| `SQUARE_ROUTING_LIVE=false` | Checkout still succeeds; routing issue; no Square API call |
| Missing item/modifier mapping | Validation failure; no silent line drops |
| Total mismatch | Admin warning; routing succeeds unless `SQUARE_TOTAL_MISMATCH_BLOCK_CENTS` set |

## Known limitations

- No Square status webhooks yet — kitchen status stays in Open Order unless manually updated.
- Total comparison uses OO vendor food subtotal + tax vs Square `order.total_money`; service fees/tips may differ by design.
- Partial audit timestamps live in `lastSquarePayload` JSON (`squareLastAttemptAt`).
