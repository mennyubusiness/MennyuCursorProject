# Square Routing Mode Unification

**Date:** July 8, 2026  
**Scope:** Use `orderRoutingMode` as the single source of truth for Square routing; remove separate admin injection toggle.

---

## Summary

Square routing now behaves like Deliverect: selecting `orderRoutingMode=square` determines vendor setup UI and post-payment routing intent. The separate `squareOrderRoutingEnabled` vendor flag is **deprecated** and no longer gates readiness or routing. `SQUARE_ROUTING_LIVE` remains the only global API kill switch.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/integrations/square/square-order-routing-readiness.ts` | Removed `squareOrderRoutingEnabled` from operational readiness |
| `src/lib/integrations/square/square-routing-readiness.ts` | Square routing mode always selectable; `assertSquareRoutingSelectable` always passes |
| `src/lib/vendor-order-routing-mode.ts` | Operational readiness + copy use routing mode only |
| `src/services/routing.service.ts` | Removed `squareOrderRoutingEnabled` gate before Square submit |
| `src/services/admin-vendor-rescue.service.ts` | Removed Square connection gate when saving routing mode |
| `AdminVendorOrderRoutingSection.tsx` | Removed injection enable/disable UI; added Square readiness card |
| `AdminSquareOrderInjectionDiagnosticsPanel.tsx` | Renamed to Square routing diagnostics; deprecated flag labeled |
| `src/lib/integrations/provider-display.ts` | `adminSquareRoutingStatusSummary`, updated kitchen copy |
| `VendorSquareSetupSummary.tsx` | Provider-aware readiness copy (no admin enablement) |
| `VendorIntegrationReadinessCard.tsx` | Removed admin enablement notice |
| `src/app/vendor/[vendorId]/setup/page.tsx` | Loads Square operational readiness for setup summary |
| `src/lib/vendor-pod-readiness.ts` | Square checklist copy uses `squareOrderRoutingReady` |
| `src/lib/vendor-dashboard-data.server.ts` | Passes `squareOrderRoutingReady` from readiness loader |
| Tests (8 files) | Updated for new behavior |

---

## `squareOrderRoutingEnabled` status

| Aspect | Status |
|--------|--------|
| Prisma schema / DB column | **Retained** (no migration this sprint) |
| Readiness gating | **Removed** — ignored for `injectionOperationalReady` |
| Post-payment routing | **Removed** — `routing.service.ts` no longer checks it |
| Admin UI toggle | **Removed** — enable/disable section deleted |
| Diagnostics panel | Shown as **deprecated/ignored** for audit visibility |
| `adminSetSquareOrderRoutingEnabled` service | **Retained** (API backward compat) but not wired to UI |

Vendors with `squareOrderRoutingEnabled=false` and `orderRoutingMode=square` will route to Square when all real prerequisites pass.

---

## New Square operational readiness

**Ready when all true:**

1. `orderRoutingMode === "square"`
2. `SQUARE_ROUTING_LIVE === true`
3. Square OAuth connection healthy
4. Selected Square location present
5. Published Square-imported menu (`square_catalog_v1`)
6. Active `ProviderEntityMapping` item coverage for routeable items
7. Required OAuth scopes present (orders/payments)

**Not required:** `squareOrderRoutingEnabled`

---

## Admin UI changes

- All routing modes (manual, Deliverect, Square) are **always selectable**
- Saving `orderRoutingMode=square` does **not** require Square connection
- Square radio shows inline readiness checklist:
  - Connection, location, menu, mappings, `SQUARE_ROUTING_LIVE`, routing status
  - Provider-aware headline copy (ready / connect / import menu / global kill switch)
- **Removed:** "Enable/Disable Square order injection" forms

---

## Post-payment routing

For `orderRoutingMode=square`:

1. `submitVendorOrder` always calls `submitVendorOrderToSquare`
2. `assertSquareOrderRoutingReady` checks operational prerequisites + `SQUARE_ROUTING_LIVE`
3. On failure: `routingStatus=failed`, routing issue created (existing Square order service behavior)
4. No silent fallback to Deliverect or manual

Manual and Deliverect branches unchanged.

---

## Vendor setup / integrations

| Mode | Vendor sees |
|------|-------------|
| `square` | Square integration summary, connection checklist, integrations hub Square card |
| `deliverect` | Deliverect setup path (unchanged) |
| `manual_dashboard` | Dashboard/tablet readiness (unchanged) |

Selecting Square before connection now drives the correct vendor UI immediately.

---

## Tests / QA

| Suite | Result |
|-------|--------|
| `square-order-routing-readiness.test.ts` | 10/10 |
| `routing.service.test.ts` | 7/7 |
| `admin-vendor-order-routing.test.ts` | 5/5 |
| `vendor-order-routing-mode.test.ts` | 16/16 |
| `provider-display.test.ts` | 19/19 |
| `admin-vendor-detail-provider.test.ts` | 8/8 |
| `vendor-pod-readiness.test.ts` | 28/28 |
| `vendor-readiness-states.test.ts` | 17/17 |
| `npm run build` | Passed |

---

## Known limitations

1. `squareOrderRoutingEnabled` column still exists — follow-up migration/TODO to remove.
2. `adminSetSquareOrderRoutingEnabled` API remains but is unused from UI.
3. Customer orderability still allows Square vendors to accept orders when connection-only setup passes (unchanged product behavior); routing fails clearly post-payment if not operational.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Admin can select Square before vendor connects | ✓ |
| Selecting Square drives Square setup UI | ✓ |
| No separate injection enable/disable section | ✓ |
| Square behaves like Deliverect (mode = intent) | ✓ |
| `SQUARE_ROUTING_LIVE` remains global kill switch | ✓ |
| Checkout, payouts, Deliverect, manual unchanged | ✓ |
