# Vendor Setup Page Cleanup (Square)

**Date:** 2026-07-08  
**Status:** Complete

## Summary

Cleaned up the vendor setup page after Square connection/menu/order injection work. The page is now provider-agnostic, no longer duplicates Square OAuth management UI, and readiness logic correctly distinguishes **Square connection setup** from **admin order-injection enablement**.

---

## Root cause: false "Connect Square — Needs attention"

The `pos` checklist item used `isVendorRoutingOperationalReady()`, which for Square mode requires:

- `squareOrderRoutingEnabled === true` (admin-only gate)
- `squareOrderRoutingReady === true` (published Square menu + full injection prerequisites)

Meanwhile the integration readiness card used `evaluateSquareConnectionHealth()`, which only checks OAuth connection + location. **Poke Sea had a healthy Square connection but failed the admin injection gate**, so the checklist showed "Connect Square — Needs attention" while the integration card showed "Connected".

**Fix:** Introduced `isVendorSetupPosReady()` for vendor-facing setup/orderability. Square mode now passes when `squareConnectionReady === true` (OAuth + location + token health). Admin injection remains gated separately via `isVendorRoutingOperationalReady()` (unchanged for post-payment routing).

---

## Files changed

| File | Change |
|------|--------|
| `src/app/vendor/[vendorId]/setup/page.tsx` | Removed full Square card; added summary row |
| `src/components/vendor/VendorSquareSetupSummary.tsx` | **New** — compact Square status + CTA |
| `src/components/vendor/VendorIntegrationReadinessCard.tsx` | Simplified; admin enablement note; no mapping counts |
| `src/components/vendor/VendorSquareConnectionCard.tsx` | Hide env mismatch warnings from vendor UI |
| `src/lib/integrations/square/square-vendor-facing-health.ts` | **New** — filter internal diagnostic warnings |
| `src/lib/vendor-order-routing-mode.ts` | `isVendorSetupPosReady()`; provider-agnostic copy |
| `src/lib/vendor-pod-readiness.ts` | Checklist uses setup POS readiness; updated labels |
| `src/lib/vendor-readiness-states.ts` | Orderability uses `isVendorSetupPosReady` |
| `src/lib/vendor-dashboard-data.server.ts` | Loads `squareConnectionReady` into `posSummary` |
| Tests | `square-vendor-facing-health.test.ts`, updated readiness + setup tests |

**Unchanged:** `/vendor/[vendorId]/integrations/square` still hosts full `VendorSquareConnectionCard` (connect/reconnect/disconnect/location).

---

## Removed from setup page

- Full `VendorSquareConnectionCard` (OAuth, merchant ID, location picker, reconnect/disconnect)
- Duplicate sandbox/production redirect warning
- Connection record details and provider mapping counts
- Square-specific page header copy

## Added to setup page

- Provider-agnostic header: *"Complete your public profile, menu, hours, payouts, and order routing setup before accepting orders."*
- Simplified integration readiness summary
- `VendorSquareSetupSummary` when routing mode is Square:
  - "Square connection: Connected / Needs attention"
  - "Manage Square integration" → `/vendor/[vendorId]/integrations/square`
  - Admin pending message when connected but `squareOrderRoutingEnabled=false`

---

## Readiness logic (vendor-facing)

| Routing mode | `pos` checklist requirement |
|--------------|----------------------------|
| `manual_dashboard` | Always ready ("Manual order dashboard ready") |
| `deliverect` | Deliverect connected + mappings |
| `square` | `evaluateSquareConnectionHealth().isReady` (connection + location) |

**Not required for vendor setup checklist:**
- `squareOrderRoutingEnabled` (admin-only)
- Sandbox `SQUARE_ENVIRONMENT`
- `SQUARE_OAUTH_REDIRECT_URL` domain mismatch
- Missing `SQUARE_WEBHOOK_SIGNATURE_KEY`
- Production credentials in sandbox

**Admin injection** (`isVendorRoutingOperationalReady`) unchanged — still requires explicit admin enable + full injection prerequisites at routing time.

---

## Sandbox/production warning handling

`SQUARE_OAUTH_REDIRECT_URL uses production domain while SQUARE_ENVIRONMENT is sandbox` is:

- **Not rendered** on vendor setup page
- **Filtered out** of `VendorSquareConnectionCard` vendor warnings
- **Not included** in readiness blockers (`evaluateSquareConnectionHealth` already only uses `missing[]` for `isReady`, not warnings)
- Retained in server config diagnostics / logs for admins

---

## Poke Sea expected state after fix

When Square is connected with location selected, Stripe ready, menu published, hours set, pod linked, and not paused:

- **Connect Square** checklist → **Ready** ("Square connected")
- **Ordering closed** banner → should clear if all operational requirements pass
- If `squareOrderRoutingEnabled=false`: informational note about admin enablement, not a false connection blocker
- Post-payment Square injection still waits for admin enable (unchanged)

---

## Tests / QA

| # | Scenario | Status |
|---|----------|--------|
| 1 | Setup page does not render full Square connection card | ✅ |
| 2 | No Reconnect/Disconnect on setup page | ✅ |
| 3 | No sandbox redirect warning in vendor Square card | ✅ |
| 4 | Provider-agnostic setup header | ✅ |
| 5 | Square-connected vendor not marked Connect Square needs attention | ✅ |
| 6 | Env mismatch does not block setup readiness | ✅ |
| 7–9 | Mode-specific routing checklist labels | ✅ |
| 10 | Admin enablement pending copy, not connection missing | ✅ |
| 11–12 | Missing connection / mappings show correct requirements | ✅ (existing menu + pos tests) |
| 13 | Deliverect/manual readiness unchanged | ✅ |
| 14 | Build passes | ✅ |

---

## Known limitations

1. Customers can pass setup readiness before admin enables Square order injection; paid orders may fail routing until admin toggles `squareOrderRoutingEnabled` (by design — injection gate unchanged).
2. Full Square OAuth management remains on integrations page only.
3. Internal env mismatch warnings still logged in `getSquareConfigSnapshot()` for operator diagnostics.

---

## Unchanged systems

- Stripe checkout and payouts
- Square order injection service and admin gate
- Deliverect and manual routing
- Square OAuth security/hardening
