# Square Menu Imports Retrofit

**Date:** 2026-07-08

## Summary

Moved the existing Square catalog preview/import UI from the Square integration page into the generic Menu Imports panel (`/vendor/{vendorId}/menu/imports`) for vendors with `orderRoutingMode=square`. The integration page now focuses on connection/location management and links to Menu Imports for catalog work.

## Files changed

| File | Change |
|------|--------|
| `src/components/vendor/VendorSquareCatalogCard.tsx` | Extracted `VendorSquareCatalogImportControls`; card is now a thin wrapper |
| `src/components/vendor/menu-imports/VendorSquareMenuImportsPanel.tsx` | Wired import controls; connection-state UX (not connected / unhealthy / healthy) |
| `src/app/vendor/[vendorId]/integrations/square/page.tsx` | Removed full catalog card; added “Manage Square menu import” link card |
| `src/actions/vendor-square-catalog.actions.ts` | Revalidates `/menu/imports` after import |
| `src/lib/integrations/square/square-routing-readiness.ts` | Added `hasConnection`, `health`, `menuImportsUrl` to status type |
| `src/lib/vendor-pod-readiness.ts` | Square setup CTAs: integrations when not connected, Menu Imports when ready |
| `src/lib/vendor-dashboard-data.server.ts` | Loads `squareCatalogImportReady` for setup checklist |
| `src/app/vendor/[vendorId]/vendor-menu-management.test.ts` | Updated Square panel + integration page tests |
| `src/actions/vendor-square-catalog.actions.test.ts` | Asserts `menu/imports` revalidation |
| `src/lib/vendor-pod-readiness.test.ts` | Square menu CTA routing tests |

## Component reuse

**`VendorSquareCatalogCard` was refactored, not rebuilt.**

- New export: `VendorSquareCatalogImportControls` — preview/import buttons, reports, warnings, and review link.
- `VendorSquareCatalogCard` remains as an optional `DashboardCard` wrapper (not used on integration page anymore).
- `VendorSquareMenuImportsPanel` loads Square status once via `loadAdminSquareRoutingStatus` and passes `health` into controls when `hasConnection` is true.

## Square Menu Imports panel behavior

| State | UX |
|-------|-----|
| Not connected | Connection status “Not connected”; amber prompt + link to `/integrations/square`; no preview/import buttons |
| Connected, unhealthy | Business/location if known; amber “not ready” prompt + link to integration; controls rendered but disabled with missing-requirement reason |
| Connected, healthy | Connected message, business, location; enabled Preview / Import; preview/import reports; post-import link to `/vendor/{vendorId}/menu-imports/{jobId}` |

## Square integration page changes

- **Removed:** full `VendorSquareCatalogCard`
- **Added:** small “Menu import” card with link **Manage Square menu import** → `/vendor/{vendorId}/menu/imports`
- Page description updated to connection/location focus only

## Setup CTA changes

Vendor setup checklist (`vendor-pod-readiness` + dashboard data):

- Square **not connected** (`squareCatalogImportReady=false`) → **Connect Square** → `/integrations/square`
- Square **connected + healthy** (`squareCatalogImportReady=true`) → **Open Menu Imports** → `/menu/imports`
- Uses `evaluateSquareConnectionHealth` at dashboard load (not `posComplete`, which is always false for Square until order injection exists)

## Import semantics (unchanged)

| Behavior | Status |
|----------|--------|
| Preview writes no `MenuImportJob` / `MenuVersion` / `ProviderEntityMapping` | Unchanged |
| Import creates `MenuImportJob` (`SQUARE_CATALOG_PULL`) | Unchanged |
| Import stores `MenuImportRawPayload` + draft `MenuVersion` | Unchanged |
| Import upserts `ProviderEntityMapping` | Unchanged |
| Re-import idempotent | Unchanged |
| Review/publish at `/vendor/{vendorId}/menu-imports/{jobId}` | Unchanged |
| No auto-publish | Unchanged |
| `Vendor.menuSource` unchanged | Unchanged |
| `orderRoutingMode` unchanged | Unchanged |
| Square normalizer untouched | Unchanged |

Server actions (`previewSquareCatalogAction`, `importSquareCatalogAction`) are route-agnostic; authorization via `canManageVendor` unchanged.

## Tests / QA

| # | Test | Result |
|---|------|--------|
| 1 | Square panel connect prompt when not connected | Pass (static + structure) |
| 2 | Square panel preview/import when connected | Pass |
| 3 | Preview no DB writes | Pass (`square-menu-import.service.test.ts`) |
| 4 | Import creates job/raw/draft | Pass (`square-menu-import.service.test.ts`) |
| 5 | Import writes `ProviderEntityMapping` | Pass (`square-menu-import.service.test.ts`) |
| 6 | Success link → `/menu-imports/{jobId}` | Pass (controls source) |
| 7 | Integration page links to Menu Imports | Pass |
| 8 | Square vendors → Menu Imports nav | Pass (existing `vendor-menu-management.test.ts`) |
| 9 | Deliverect imports unchanged | No code changes to Deliverect panel |
| 10 | Manual vendors → Menu Builder | Pass (existing tests) |
| 11 | Build | Pass |

**Commands run:**

```bash
npm run test -- --run src/lib/vendor-pod-readiness.test.ts src/actions/vendor-square-catalog.actions.test.ts src/app/vendor/[vendorId]/vendor-menu-management.test.ts src/lib/integrations/square/square-menu-import.service.test.ts
npm run build
```

## Known limitations

- Square vendors remain **non-orderable** until Square order injection is implemented (`SQUARE_ROUTING_NOT_IMPLEMENTED` at checkout).
- `posComplete` / POS checklist item for Square still reflects routing readiness (false), separate from catalog import readiness.
- Setup checklist `squareCatalogImportReady` is evaluated on dashboard/setup data load only (not live-updated without navigation).
- `VendorSquareCatalogCard` wrapper retained for potential reuse but is not mounted on any page after this change.
