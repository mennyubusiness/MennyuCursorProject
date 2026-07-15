# Square Launch Hardening — Sprint Deliverable

**Date:** 2026-07-15  
**Goal:** Prevent Open Order from collecting payment for Square-routed carts unless every ordered entity is routable at the vendor’s selected Square location. Eliminate the Poke Sea class of paid-but-not-routed failures.

---

## Verdict

Launch-critical prevention for **partial mapping coverage** and **cross-location drift** is implemented and covered by tests. Square vendors with incomplete mappings at the selected location are **not orderable**, and checkout **blocks before payment** with `SQUARE_CART_PREFLIGHT_FAILED`.

---

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/integrations/square/square-mapping-coverage.server.ts` | Full sellable-menu coverage + exact cart-line routability |
| `src/lib/integrations/square/square-order-routing-readiness.ts` | Replaced “any mapping” with full coverage readiness |
| `src/lib/integrations/square/square-cart-preflight.server.ts` | Pre-payment cart preflight for Square vendors |
| `src/lib/integrations/square/square-routing-failure.ts` | Normalized failure payload + customer-safe message |
| `src/lib/integrations/provider-mapping.service.ts` | `deactivateSquareMappingsOutsideLocation` |
| `src/lib/integrations/square/square-connection.service.ts` | Location change quarantine + transactional single-active upsert |
| `src/lib/integrations/square/square-menu-import.service.ts` | Clears `menuRequiresRepublish` after successful import sync |
| `src/lib/vendor-order-routing-mode.ts` | `isVendorSquareOrderable` |
| `src/lib/vendor-readiness-states.ts` | `square_routing` operational blocker |
| `src/lib/vendor-readiness-validation.server.ts` | Loads `squareOrderRoutingReady` from injection readiness |
| `src/lib/vendor-pod-readiness.ts` | Merges Square readiness flags into evaluation posSummary |
| `src/services/order.service.ts` | Runs Square cart preflight inside `validateCartForOrder` |
| `src/services/square-order.service.ts` | Persists structured `routingFailure` on readiness/mapping fail |
| `src/actions/vendor-square-connect.actions.ts` | Actor + routing readiness for Square UI |
| `src/actions/admin-square-mapping.actions.ts` | Admin deactivate stale other-location mappings |
| `src/components/vendor/VendorSquareConnectionCard.tsx` | Coverage + non-orderable messaging; location-change warning |
| `src/app/vendor/.../integrations/square/page.tsx` | Passes routing readiness into connection card |
| `src/app/admin/.../AdminSquareOrderInjectionDiagnosticsPanel.tsx` | Coverage + stale-mapping deactivate control |
| `src/app/admin/.../AdminDeactivateStaleSquareMappingsButton.tsx` | Admin UX for quarantining other-location mappings |
| `src/lib/integrations/square/admin-square-order-injection-diagnostics.server.ts` | Exposes mappingCoverage |
| `src/lib/admin-audit-log.ts` | `SQUARE_LOCATION_CHANGED`, `SQUARE_STALE_MAPPINGS_DEACTIVATED` |
| `prisma/migrations/20260715140000_square_one_active_connection/migration.sql` | Partial unique index: one active Square connection per vendor |
| `prisma/schema.prisma` | Documents partial unique index |
| Tests under `src/lib/integrations/square/*`, vendor readiness/orderability, order cart validation, square-order.service | Launch-critical coverage |

---

## Schema and migrations

**Added:** `prisma/migrations/20260715140000_square_one_active_connection/migration.sql`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "VendorIntegrationConnection_one_active_square_per_vendor"
ON "VendorIntegrationConnection" ("vendorId", "provider")
WHERE "isActive" = true AND "provider" = 'square';
```

No new columns. Historical inactive Square connection rows remain allowed.

Apply with your usual migrate deploy path before production enablement.

---

## Readiness behavior before and after

| | Before | After |
|--|--------|-------|
| Item mappings gate | `activeItemMappingCount > 0` | Every **sellable** operational available item mapped at selected location |
| Cross-location maps | Counted only at selected location (stale old-location maps ignored for count but left active) | `MAPPING_AT_DIFFERENT_LOCATION` blockers; not ready |
| Required modifiers | Not required for readiness | Required groups/options must be mapped at selected location |
| Optional modifiers | N/A | Not required until selected (cart preflight checks selections) |
| Structured result | Counts + string blockers | `mappingCoverage` + `coverageBlockers` |

`prerequisitesReady` = connection + scopes + location + Square-published menu + **coverage ready**.  
`injectionOperationalReady` = prerequisites + `SQUARE_ROUTING_LIVE`.  
Public orderability uses `squareOrderRoutingReady` = `injectionOperationalReady`.

---

## Checkout behavior before and after

| | Before | After |
|--|--------|-------|
| `validateCartForOrder` | Orderability + Deliverect kitchen mapping | Same + **`validateSquareCartPreflight`** |
| Payment Intent | After order create from cart | Still after order create — **validation already failed** if Square cart unroutable |
| Failure code | N/A | `SQUARE_CART_PREFLIGHT_FAILED` |
| Customer message | N/A | “One or more items are no longer available from this vendor…” |
| Multi-vendor | Sibling Square vendor could fail post-pay | Any Square vendor failing preflight **blocks the whole checkout** before charge |

Preflight does **not** call Square CreateOrder/CreatePayment.

---

## Location-change behavior

On `selectSquareLocationForVendor` when location **changes**:

1. Transaction updates connection location + sets `menuRequiresRepublish: true`.
2. Deactivates all active Square mappings for that vendor **outside** the new location.
3. Audit log `SQUARE_LOCATION_CHANGED` with previous/new location and deactivated count.
4. Vendor immediately fails coverage readiness until re-import + publish at the new location.

Successful catalog import sync clears `menuRequiresRepublish`.

---

## Test results

**Command:**

```bash
npx vitest run \
  src/lib/integrations/square/square-mapping-coverage.test.ts \
  src/lib/integrations/square/square-order-routing-readiness.test.ts \
  src/lib/integrations/square/square-cart-preflight.test.ts \
  src/lib/integrations/square/square-location-mapping-quarantine.test.ts \
  src/lib/integrations/square/square-connection.service.test.ts \
  src/lib/integrations/square/admin-square-order-injection-diagnostics.test.ts \
  src/lib/vendor-readiness-states.test.ts \
  src/lib/vendor-order-routing-mode.test.ts \
  src/lib/vendor-readiness-validation.server.test.ts \
  src/lib/vendor-pod-readiness.test.ts \
  src/services/square-order.service.test.ts \
  src/services/order.service.cart-validation.test.ts
```

**Result:** **12 files, 138 passed.**

### Tests added (high signal)

- Coverage: zero / partial / full / unavailable ignored / Poke Sea wrong-location / required mod / optional mod / inactive / other vendor scope / location unset
- Cart preflight: readiness fail, multi-vendor one-fail, modifier fail, non-Square pass-through
- Location quarantine deactivates outside selected location
- Orderability: visible but closed when `squareOrderRoutingReady` false
- Bundles load `squareOrderRoutingReady`; incomplete coverage blocks orderability

---

## Remaining risks (intentionally out of sprint)

- Square refund / cancel money synchronization
- Background status polling when webhooks are silent
- OO → Square catalog export
- Full Kitchen Mode nav cleanup
- Long-term Square sales reporting reconciliation
- Concurrent OAuth callback race under extreme load (mitigated by partial unique index + transactional deactivate)

---

## Acceptance criteria checklist

- [x] Square vendor not orderable with partial menu mapping coverage
- [x] Mapping at a different Square location never satisfies readiness
- [x] Changing Square location immediately makes vendor non-orderable (coverage empty + quarantined maps)
- [x] Old-location mappings cannot be used for new orders
- [x] Exact cart validated against selected location before payment (`validateCartForOrder`)
- [x] Unroutable Square cart cannot be charged (preflight failure)
- [x] Multi-vendor checkout cannot charge when any Square vendor fails preflight
- [x] Reconnect path deactivates other actives; DB unique partial index enforces one active
- [x] Structured diagnostics persisted on readiness/mapping submit failures (`routingFailure`)
- [x] Poke Sea scenario reproduced in tests and prevented
- [x] Manual/Deliverect paths unchanged in targeted tests
- [x] Relevant tests pass (138)
