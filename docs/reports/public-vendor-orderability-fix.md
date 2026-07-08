# Public Vendor Page False “Not Taking Orders” Fix

**Date:** 2026-07-08  
**Status:** Complete

## Summary

The public customer vendor page (`/[podSlug]/[vendorSlug]`) and pod vendor grid used `loadVendorReadinessBundles()` for orderability, but that loader did **not** populate `squareConnectionReady` on `posSummary`. Square vendors therefore failed `isVendorSetupPosReady()` on public surfaces while dashboard/setup (via `loadVendorDashboardContext`) correctly showed them as open.

---

## Root cause

| Surface | Data loader | `squareConnectionReady` on `posSummary` |
|---------|-------------|----------------------------------------|
| Dashboard / setup | `loadVendorDashboardContext` | ✅ Loaded via `evaluateSquareConnectionHealth` |
| Public vendor page | `loadVendorReadinessBundles` | ❌ **Missing** |
| Pod customer page | `loadVendorReadinessBundles` | ❌ **Missing** |
| Cart / checkout validation | `loadVendorReadinessBundles` | ❌ **Missing** |

**Public orderability path:**

```
renderVendorMenuCustomerPage
  → loadVendorReadinessBundles
  → getVendorOrderabilityInPod
  → getVendorOrderabilityState
  → getVendorOperationalMissingItems
  → isVendorPosReady → isVendorSetupPosReady
  → square mode requires squareConnectionReady === true
```

With `squareConnectionReady` undefined, Square vendors were always blocked with “Not accepting orders right now” despite healthy OAuth connection.

**`squareOrderRoutingEnabled` was NOT the public blocker** — it is only checked by `isVendorRoutingOperationalReady()` (admin injection / post-payment routing). The public page never read that flag; the bug was the missing connection health field.

---

## Fix

### 1. `loadVendorReadinessBundles` (`vendor-readiness-validation.server.ts`)

For vendors with `orderRoutingMode === "square"`, batch-load `evaluateSquareConnectionHealth()` and set:

```typescript
posSummary.squareConnectionReady = health.isReady
```

### 2. Explicit customer orderability helper (`vendor-readiness-states.ts`)

Added `isVendorCustomerOrderable()` as a named alias for `getVendorOrderabilityState().orderable`.

### 3. Revalidation (`revalidate-vendor-pod-surfaces.server.ts`)

Added `revalidateVendorCustomerOrderingSurfaces(vendorId)` and wired it to:

- Square OAuth callback
- Square location select / disconnect actions
- Menu import publish
- Vendor pause toggle
- Customer ordering hours update

Ensures public pod/vendor pages refresh after orderability-affecting changes.

---

## Readiness function separation (unchanged intent, now aligned)

| Function | Purpose |
|----------|---------|
| `isVendorCustomerOrderable` / `getVendorOrderabilityState` | **Public/cart/checkout** — can customer order now? |
| `isVendorSetupPosReady` | **Vendor setup checklist** — connection ready (not admin injection) |
| `isVendorRoutingOperationalReady` | **Post-payment Square injection** — requires `squareOrderRoutingEnabled` + full injection prerequisites |

Admin `squareOrderRoutingEnabled` does **not** block public ordering.

---

## Menu source

No change required. `menuItemDeliverectIdMatchesMenuSource` already accepts `sq:prod:*` IDs for `menuSource=open_order`. Published Square-imported menus load via existing customer menu cache.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/vendor-readiness-validation.server.ts` | Load `squareConnectionReady` for Square vendors |
| `src/lib/vendor-readiness-states.ts` | `isVendorCustomerOrderable()` |
| `src/lib/revalidate-vendor-pod-surfaces.server.ts` | `revalidateVendorCustomerOrderingSurfaces` |
| `src/actions/vendor-square-connect.actions.ts` | Revalidate public surfaces |
| `src/app/api/integrations/square/oauth/callback/route.ts` | Revalidate after OAuth |
| `src/app/api/vendor/.../menu-imports/.../publish/route.ts` | Revalidate after publish |
| `src/app/api/vendor/.../pause/route.ts` | Revalidate after pause |
| `src/app/api/vendor/.../customer-ordering-hours/route.ts` | Revalidate after hours |
| Tests | `vendor-readiness-states.test.ts`, `vendor-readiness-validation.server.test.ts` |

**Unchanged:** checkout, payouts, Square injection, Deliverect/manual routing, admin injection gate.

---

## Poke Sea expected state

When Square OAuth + location are healthy, menu published, Stripe ready, hours open, not paused:

- Dashboard: open ✅
- Setup: ready ✅
- Public page: **orderable** ✅ (add-to-cart enabled)
- Post-payment Square injection: still requires admin `squareOrderRoutingEnabled` (unchanged)

---

## Tests / QA

| # | Scenario | Status |
|---|----------|--------|
| 1 | Dashboard/setup open → public orderable with bundle fix | ✅ |
| 2 | `squareOrderRoutingEnabled` not a public blocker | ✅ |
| 3 | Square connected + admin injection off → public orderable | ✅ |
| 4 | Missing Square connection blocks public ordering | ✅ |
| 5 | `sq:prod:*` menu IDs accepted (`vendor-menu-source.test.ts`) | ✅ (existing) |
| 6 | Closed hours / paused / no menu still block | ✅ (existing) |
| 7 | Deliverect/manual unchanged | ✅ |
| 8 | Build passes | ✅ |

---

## Known limitations

1. Public ordering can succeed before admin enables Square order injection; paid orders may fail routing until admin toggles (by design — manual recovery remains).
2. `evaluateSquareConnectionHealth` runs per Square vendor when loading readiness bundles (acceptable for pod pages with few vendors; same cost as dashboard).
