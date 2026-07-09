# Vendor Setup Page — Integrations Layout & Collapsible Checklists

**Date:** 2026-07-08

## Summary

The vendor setup page now uses collapsible readiness checklists and a provider-aware **Integrations** section. The generic **Integration readiness** card (which surfaced irrelevant Square connection warnings for Deliverect vendors) was removed from setup. Checkout, payouts, and routing behavior are unchanged.

## Files changed

| File | Change |
|------|--------|
| `src/components/vendor/VendorSetupChecklist.tsx` | Collapsible checklist UI with header badge, completion count, chevron |
| `src/lib/vendor-setup-checklist-summary.ts` | Summary helpers (`readyCount`, `defaultExpanded`, incomplete labels) |
| `src/lib/vendor-setup-integrations.ts` | Provider-aware integrations view model builder |
| `src/components/vendor/VendorSetupIntegrationsSection.tsx` | New Integrations section UI |
| `src/app/vendor/[vendorId]/setup/page.tsx` | Reordered layout; replaced old integration card |
| `src/lib/vendor-setup-checklist-summary.test.ts` | Checklist collapse tests |
| `src/app/vendor/[vendorId]/vendor-setup-integrations.test.ts` | Integrations provider/layout tests |
| `src/app/vendor/[vendorId]/vendor-dashboard-redesign.test.ts` | Updated setup page expectations |

**Unchanged (still used elsewhere):**

- `VendorIntegrationReadinessCard` — vendor `/integrations` hub
- `VendorSquareSetupSummary` — component retained; no longer on setup page
- Admin diagnostics, routing services, checkout, payouts

## Checklist collapse behavior

Each checklist section (`Required to appear on pod page`, `Required to accept orders`) now has:

- **Header:** title, Ready / Needs attention badge, `N of M ready`, chevron
- **Default state:** expanded when any item is incomplete; collapsed when fully ready
- **Manual toggle:** vendor can expand/collapse at any time
- **Collapsed summary:** lists incomplete item labels when not ready; “All requirements complete” when ready

The locked “Required to accept orders” placeholder (when public profile is incomplete) remains a static dashed section.

## New Integrations section layout

Placed **below** setup checklists.

**Title:** Integrations  
**Subtitle:** Manage how this vendor receives orders and keeps menus in sync.

### Cards

1. **Active order routing** — only the selected `orderRoutingMode`
2. **Active menu source** — independent of routing (`menuSource` + routing-aware labels)
3. **Available integrations** — collapsed `<details>` with non-blocking inactive providers

## What replaced the old Integration readiness card

Removed from setup:

- `VendorIntegrationReadinessCard` (Order routing / Menu source / Square connection rows)
- `VendorSquareSetupSummary` duplicate Square block

Replaced with `VendorSetupIntegrationsSection` driven by `buildVendorSetupIntegrationsView()`.

## Provider-specific behavior

| Routing mode | Active routing card | Inactive providers |
|--------------|--------------------|--------------------|
| **Deliverect** | Deliverect readiness only | Square, Toast in Available (neutral styling) |
| **Square** | Square readiness only | Deliverect, Toast in Available |
| **Manual / tablet** | Open Order Dashboard / Tablet | Square, Deliverect, Toast in Available |

**Menu source card (independent):**

- Deliverect → “Menu source: Deliverect”
- Square routing + open_order menu → “Menu source: Square catalog”
- Otherwise → “Menu source: Open Order menu builder”

Inactive provider cards use **Available** / **Not configured** / **Coming soon** — never amber warning styling unless that provider is the active routing or menu source card.

## Inactive provider handling

- Square not connected does **not** appear as a setup blocker for Deliverect or manual vendors
- Deliverect not connected does **not** appear as a setup blocker for Square or manual vendors
- Optional links (e.g. “View Square integration”) live under collapsed Available integrations

## Tests / QA

| Test | Result |
|------|--------|
| `vendor-setup-checklist-summary.test.ts` (3) | Pass |
| `vendor-setup-integrations.test.ts` (10) | Pass |
| `vendor-dashboard-redesign.test.ts` (8) | Pass |
| `npm run build` | Pass |

Covers acceptance criteria: collapsible checklists, no cross-provider setup warnings, routing-driven active cards, independent menu source, collapsed available integrations.

## Known limitations

- **Toast** is a placeholder (“Coming soon”) with no connection flow.
- **Menu source vs routing mismatch** (e.g. Deliverect menu + manual routing) is shown via menu source title/readiness but not a dedicated mismatch banner on setup.
- **Vendor integrations hub** (`/vendor/[id]/integrations`) still uses `VendorIntegrationReadinessCard`; only the setup page was migrated to the new section.
- Collapsed checklist state resets on full page navigation (no persistence in localStorage).

## Behavior unchanged

- Checkout and post-payment routing validation
- Payouts
- Square injection and Deliverect/manual routing logic
- Admin diagnostics and integration detail pages
