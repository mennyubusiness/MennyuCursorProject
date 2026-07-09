# Provider UX Regression Audit & Dead Code Cleanup

**Date:** 2026-07-08

## Summary

Confirmed provider-aware integration UX is consistent across vendor setup, integrations hub, admin vendor detail, menu imports, and kitchen mode. Removed two unused legacy components. Public/customer and checkout surfaces remain free of provider diagnostics. Routing, payouts, and injection behavior unchanged.

## Files removed

| File | Reason |
|------|--------|
| `src/components/vendor/VendorIntegrationReadinessCard.tsx` | Zero callers after setup/hub migration |
| `src/components/vendor/VendorSquareSetupSummary.tsx` | Zero callers; superseded by `VendorIntegrationsSection` |

## Files added

| File | Purpose |
|------|---------|
| `src/lib/provider-ux-regression.test.ts` | Dead-code scan, cross-surface consistency, inactive-provider blocker rules |

## Remaining provider-aware entry points

| Surface | Entry point | Provider model |
|---------|-------------|----------------|
| Vendor setup | `loadVendorIntegrationsViewModel(..., "setup")` → `VendorIntegrationsSection` | Active routing + menu source; collapsed available |
| Integrations hub | `loadVendorIntegrationsViewModel(..., "hub")` → `VendorIntegrationsSection` | + connected integrations; hub CTAs |
| Shared builder | `buildVendorSetupIntegrationsView` in `vendor-setup-integrations.ts` | Single source of truth |
| Shared loader | `vendor-integrations-view.server.ts` | Wraps observability + dashboard context |
| Menu imports | `vendorMenuImportsPageSubtitle`, `getProviderDisplayProfile` | Routing-aware subtitles |
| Kitchen mode | `vendorKitchenStatusWarning`, `vendorKitchenModeNotice` | Provider-aware operational copy |
| Admin vendor detail | `AdminVendorOrderRoutingSection`, diagnostics panels | Mode selector + gated diagnostics |
| Square OAuth detail | `VendorSquareConnectionCard` on `/integrations/square` | Actionable Square setup only |

**Retained (not dead):**

- `getVendorIntegrationObservability` — used by shared loader
- `VendorSquareConnectionCard` — Square detail page
- `integratedOrderRoutingLabel` — menu imports labels (deprecated alias, still used)
- Deliverect/Square menu import panels — provider-specific actionable pages

## Manual / Deliverect / Square QA (code + test verification)

### Manual / tablet vendor

- **Active routing:** Open Order Dashboard / Tablet — Ready when mode selected
- **Inactive:** Square, Deliverect, Toast in Available — neutral status only
- **Kitchen:** Dashboard/tablet notice; no POS missing warnings
- **Setup/hub:** No Square or Deliverect required in checklists beyond routing-mode-specific `pos` row (manual dashboard ready)

### Deliverect vendor

- **Active routing:** Deliverect — readiness from Deliverect adapter only
- **Inactive Square:** Available / Not configured — never `needs_attention`
- **Menu source:** Deliverect card independent of routing
- **Admin:** Deliverect Menu/POS section; no Square warnings in routing selector
- **Kitchen:** Deliverect live/POS-managed UI paths unchanged

### Square vendor

- **Active routing:** Square — readiness from Square adapter only
- **Inactive Deliverect:** neutral in Available/Connected
- **Menu source:** Square catalog card with menu import CTA
- **Square detail:** OAuth/location on `/integrations/square`
- **Admin:** Square injection diagnostics gated to Square routing vendors

### Public / customer

- Pod vendor menu page (`/[podSlug]/[vendorSlug]`) — no integration readiness, Square connection, or `SQUARE_ROUTING_LIVE` copy
- Checkout — no imports of vendor integration setup helpers

### Behavior unchanged

- Checkout flow
- Payouts
- Square injection (`SQUARE_ROUTING_LIVE`, `routing.service`)
- Deliverect routing
- Manual/tablet routing

## Tests / QA

| Suite | Result |
|-------|--------|
| `provider-ux-regression.test.ts` (10) | Pass |
| `vendor-setup-integrations.test.ts` (16) | Pass |
| `admin-vendor-detail-provider.test.ts` (10) | Pass |
| `provider-display.test.ts` (19) | Pass |
| `vendor-order-routing-mode.test.ts` (16) | Pass |
| `admin-vendor-order-routing.test.ts` (5) | Pass |
| `npm run build` | Pass |

## Known limitations

- **Visual browser QA** not automated — consistency verified via source/tests, not live screenshots.
- **`integratedOrderRoutingLabel`** remains as deprecated alias; consolidation optional later.
- **Toast** placeholder still shown in Available integrations with no connection flow.
- **Kitchen “Needs attention”** on individual orders (routing retry) is operational, not integration-setup diagnostics.
- **Vendor integrations hub** and **setup** share model but hub exposes more CTAs — intentional.
