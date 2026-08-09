# Menu source ownership when switching order routing modes

**Date:** 2026-08-08  
**Status:** Implemented

## Root cause

Menu Builder UX was gated by `Vendor.orderRoutingMode`, while the customer storefront resolved the live catalog from `Vendor.menuSource` plus published `MenuVersion` rows.

Admin routing changes updated `orderRoutingMode` and `menuSource`, but **did not demote** the previously published provider menu. Combined with:

1. Possible historical mismatch (`manual_dashboard` + `menuSource = deliverect`)
2. Coarse `VendorMenuSource` values (`open_order` covers both native builder and Square)
3. Occasional unfiltered “latest published” readers

…a Deliverect (or other provider) catalog could remain authoritative on the storefront after the vendor was switched to tablet/`manual_dashboard`.

## Architectural rule (now enforced)

- **Stored menu data** may include Open Order, Deliverect, and Square history.
- **Authoritative menu** is exactly one active provider per vendor, derived from routing mode:

| `orderRoutingMode` | `Vendor.menuSource` | Active provider |
|--------------------|---------------------|-----------------|
| `manual_dashboard` | `open_order` | `open_order` |
| `deliverect` | `deliverect` | `deliverect` |
| `square` | `open_order` | `square` |

Central helper: `resolveActiveMenuSource(vendor)` in `src/lib/vendor-menu-source.ts`.

Storefront / operational catalog selection: `loadActiveMenuVersionForVendor` filters by **active provider** (not merely `VendorMenuSource`), so Square and native Open Order never merge.

## What changed

### 1. Routing-mode change reconciles ownership

`adminUpdateVendorOrderRoutingMode` now runs `reconcileVendorMenuSourceOwnership` in a transaction:

- Sets `menuSource` from routing mode
- Archives published `MenuVersion`s that are not the active provider
- Soft-disables live `MenuItem`s that do not belong to the active provider
- Does **not** delete historical menus, mappings, or order line items
- Revalidates customer + operational menu caches

### 2. Storefront / operational reads are provider-aware

- `loadActiveMenuVersionForVendor` selects only versions matching the active provider from routing mode
- Stale Deliverect published rows are ignored when routing is `manual_dashboard` (even if `menuSource` pointer is temporarily stale)
- Fallback winners for open_order / square require an explicit publish (empty until publish)
- Customer fallback filters with `menuItemMatchesActiveProvider`

### 3. Menu Builder authorization

`authorizeOpenOrderMenuBuilder` gates on routing mode → active provider `open_order`, so tablet vendors are not blocked by a stale Deliverect `menuSource` pointer.

### 4. Existing vendor repair

- Service: `repairInconsistentVendorMenuSourceOwnership`
- Admin action: `adminRepairVendorMenuSourceOwnershipAction`
- CLI (dry-run by default):

```bash
npm run menu:repair-source-ownership
npm run menu:repair-source-ownership:execute
npx tsx scripts/repair-vendor-menu-source-ownership.ts --vendor=<id> --execute
```

Targets only vendors with `menuSource` mismatch and/or foreign published `MenuVersion`s. Correctly integrated vendors are left alone.

## Data model

No Prisma schema changes. Reuses:

- `Vendor.orderRoutingMode`
- `Vendor.menuSource`
- `MenuVersion.state` (`published` → `archived`)
- `MenuItem.isAvailable` soft-disable

## Files changed

| Area | Files |
|------|--------|
| Resolution helpers | `src/lib/vendor-menu-source.ts`, `src/lib/vendor-active-menu-version.server.ts` |
| Ownership reconcile | `src/services/vendor-menu-source-ownership.service.ts` |
| Routing switch | `src/services/admin-vendor-rescue.service.ts`, `src/actions/admin-vendor.actions.ts` |
| Storefront / ops | `src/services/vendor-customer-menu.service.ts`, `src/services/menu-active-scope.service.ts` |
| Builder auth | `src/actions/vendor-menu-builder.actions.ts` |
| Adapter readiness | `src/lib/integrations/adapters/open-order-menu.adapter.ts` |
| Repair CLI | `scripts/repair-vendor-menu-source-ownership.ts`, `package.json` scripts |
| Tests | `vendor-menu-source*.test.ts`, `vendor-active-menu-version.server.test.ts`, `vendor-menu-source-ownership.service.test.ts`, `admin-vendor-order-routing.test.ts` |

## How to repair the known inconsistent vendor

1. Dry-run: `npm run menu:repair-source-ownership`
2. Confirm the vendor appears (manual routing + Deliverect menu source / published Deliverect version)
3. Execute: `npm run menu:repair-source-ownership:execute`  
   or scoped: `npx tsx scripts/repair-vendor-menu-source-ownership.ts --vendor=<id> --execute`
4. Verify storefront is empty (or native-only after publish) and Menu Builder is editable

## Regression tests performed

| Case | Expected | Result |
|------|----------|--------|
| 1 — Deliverect vendor | Deliverect published selected | Pass |
| 2 — Deliverect → tablet | `open_order` source; Deliverect archived + soft-disabled; storefront ignores Deliverect | Pass |
| 3 — Native publish | Only `open_order_builder_v1` selected | Pass |
| 4 — Tablet → Deliverect | Native archived; Deliverect authoritative; no merge | Pass |
| 5 — Square | `square_catalog_v1` selected; native/Deliverect demoted on switch to square | Pass |
| Square readiness / setup UX suites | No regressions | Pass (37 tests) |

## Null / undefined semantics (ownership)

- Historical provider menus: retained as `archived` / `isAvailable: false`
- Orders: untouched (still reference historical `MenuItem` ids)
- Active storefront catalog: only the active provider’s published (or same-provider archived fallback) snapshot
