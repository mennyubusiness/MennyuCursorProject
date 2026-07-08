# Provider-Aware Vendor/Admin Page Cleanup

**Date:** July 8, 2026  
**Scope:** Generic POS routing UX — remove hardcoded Deliverect/Square copy from shared vendor/admin pages.

---

## Summary

Vendor and admin pages now use a centralized **provider display registry** (`src/lib/integrations/provider-display.ts`) instead of hardcoded Deliverect- or Square-specific strings. Kitchen Mode, Menu management/imports, admin vendor detail, and a new integrations hub all render provider-aware copy based on `orderRoutingMode` and import source.

**No behavioral changes** to checkout, payouts, Square order injection, Deliverect routing, manual/tablet routing, or menu publish/import flows.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/integrations/provider-display.ts` | **New/extended** — registry + helpers for subtitles, banners, kitchen notices, admin tool gating |
| `src/lib/integrations/provider-display.test.ts` | **New** — 11 unit tests |
| `src/lib/vendor-order-routing-mode.ts` | Kitchen status line/warning delegate to registry |
| `src/lib/vendor-menu-route-guard.server.ts` | Re-export `integratedOrderRoutingLabel` from registry |
| `src/app/vendor/[vendorId]/kitchen/page.tsx` | Square injection operational state passed to kitchen notice |
| `src/app/vendor/[vendorId]/menu/imports/page.tsx` | Provider-aware title/subtitle/import source |
| `src/app/vendor/[vendorId]/integrations/page.tsx` | **New** — generic integrations hub |
| `src/app/vendor/[vendorId]/integrations/square/page.tsx` | Back link → integrations hub |
| `src/app/admin/(dashboard)/vendors/[vendorId]/page.tsx` | Provider-aware Tools section |
| `src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorRescueClient.tsx` | Gated Square diagnostics + Deliverect Menu/POS section |
| `src/app/admin/(dashboard)/vendors/[vendorId]/menu-history/page.tsx` | Provider-aware subtitle |
| `src/app/admin/(dashboard)/vendors/[vendorId]/menu-history/VendorImportsSection.tsx` | Generic "Menu imports" + source-aware draft banner |
| `src/lib/vendor-order-routing-mode.test.ts` | Updated kitchen copy expectations |
| `src/app/vendor/[vendorId]/vendor-menu-management.test.ts` | Provider-aware page structure tests |

---

## Hardcoded strings removed

| Location | Before | After |
|----------|--------|-------|
| Kitchen Mode (all Square vendors) | "Square order injection is not live yet…" | Injection-aware: enabled vs not active |
| Vendor menu imports subtitle | Deliverect-biased | `vendorMenuImportsPageSubtitle(mode)` |
| Admin menu-history subtitle | "Deliverect imports, draft review…" | `vendorMenuManagementPageSubtitle(mode, name)` |
| Admin import draft banner | "A Deliverect import is waiting…" | `menuImportDraftReviewBanner(source, name)` |
| Admin import section heading | "Deliverect imports" | "Menu imports" |
| Admin vendor Tools | Always Deliverect labels | Gated by routing mode |
| Admin Menu/POS section | Always Deliverect fields + refresh | Visible only for Deliverect routing |
| Admin Square diagnostics | Shown for all vendors | Gated to Square routing only |

**Intentionally unchanged (provider-specific panels):**
- `VendorDeliverectMenuImportsPanel` / `VendorSquareMenuImportsPanel` — correct split by mode
- `menu-import-ui-labels.ts` row labels ("Square catalog", "Deliverect menu") — source-specific by design
- Square integration sub-page — Square-specific by design
- `connect-pos` wizard — Deliverect-specific by design

---

## Provider display registry

**File:** `src/lib/integrations/provider-display.ts`

Maps `manual_dashboard` | `deliverect` | `square` (+ Toast placeholder) to:

- `displayName`, `shortName`, `routingDescription`
- `menuImportLabel`, `catalogLabel`, `connectedLabel`
- `menuImportsSectionTitle`

**Key helpers:**

| Helper | Purpose |
|--------|---------|
| `vendorMenuImportsPageSubtitle` | Vendor menu imports page subtitle |
| `vendorMenuManagementPageSubtitle` | Admin menu-history subtitle |
| `menuImportDraftReviewBanner` | Draft-awaiting-review banner by import source |
| `vendorKitchenModeNotice` / `vendorKitchenModeStatusLine` | Kitchen Mode banners |
| `adminSquareInjectionDiagnosticsVisible` | Gate Square admin panel |
| `adminDeliverectMenuPosSectionVisible` | Gate Deliverect Menu/POS section |
| `adminPosMappingToolVisible` | Gate Deliverect mapping tool link |
| `adminMenuManagementToolDescription` | Admin Tools card description |

---

## Page responsibilities (final)

| Page | Responsibility |
|------|----------------|
| **Setup** (`/vendor/[id]/setup`) | General readiness checklist; integration summary card (provider-agnostic framing) |
| **Integrations hub** (`/vendor/[id]/integrations`) | Active routing summary, readiness, provider connection cards |
| **Square integration** (`/vendor/[id]/integrations/square`) | Square OAuth, location, connection health |
| **Connect POS** (`/vendor/[id]/connect-pos`) | Deliverect channel wizard (redirects manual vendors) |
| **Menu management/imports** (`/vendor/[id]/menu/imports`) | Draft/import review, publish — shared page, provider panels swapped |
| **Menu builder** (`/vendor/[id]/menu-builder`) | Manual/Open Order menu editing |
| **Kitchen mode** (`/vendor/[id]/kitchen`) | Operational order board with provider-aware notices |
| **Admin vendor detail** (`/admin/vendors/[id]`) | Admin diagnostics/toggles grouped by active routing |
| **Admin menu-history** (`/admin/vendors/[id]/menu-history`) | Admin import review + snapshots (provider-aware copy) |

**No pages deleted.** Legacy `/menu-imports` redirect retained.

---

## Provider-specific behavior

### manual_dashboard / tablet

- Kitchen: no POS warning; optional status line about Open Order orders
- Menu: Menu Builder (not imports page)
- Integrations hub: Dashboard routing card; no POS requirement implied
- Admin: no Square injection panel, no Deliverect Menu/POS section, no POS mapping tool

### Deliverect

- Kitchen: POS-managed vs fallback copy based on connection state
- Menu: Deliverect panel on shared imports page
- Integrations hub: Deliverect connection card → connect-pos
- Admin: Deliverect Menu/POS section, mapping tool, no Square injection panel

### Square

- Kitchen: injection operational vs not active (loads `loadSquareOrderRoutingReadiness`)
- Menu: Square panel on shared imports page; "Square catalog import" labels
- Integrations hub: Square card → integrations/square
- Admin: Square injection diagnostics panel; no Deliverect Menu/POS section

### Toast (placeholder only)

- `TOAST_PLACEHOLDER_PROFILE` in registry; no UI wiring or behavior

---

## Tests / QA

| Test file | Result |
|-----------|--------|
| `provider-display.test.ts` | 11/11 passed |
| `vendor-order-routing-mode.test.ts` | 16/16 passed |
| `vendor-menu-management.test.ts` | 13/13 passed |
| `npm run build` | Passed (Prisma pool timeouts during static gen — pre-existing, non-blocking) |

**Part 8 coverage:**

1. Square vendor menu imports — no Deliverect in page source ✓
2. Deliverect vendor — Deliverect copy, not Square ✓
3. Manual vendor — no Deliverect/Square required on imports (redirects to builder) ✓
4. Kitchen manual — no Square/Deliverect warning ✓
5. Kitchen Square — Square copy only ✓
6. Kitchen Deliverect — Deliverect copy only ✓
7. Setup — provider-agnostic descriptions ✓
8. Admin Square panel — gated ✓
9. Admin Deliverect panel — gated ✓
10. Public customer pages — unchanged (no provider diagnostics) ✓
11–13. Injection/import/routing behavior — unchanged (copy-only diff) ✓
14. Build passes ✓

---

## Known limitations

1. **Admin still loads Square diagnostics data** for all vendors server-side; only the UI panel is gated. Could optimize to skip DB calls for non-Square vendors.
2. **Setup page** still shows `VendorSquareSetupSummary` for Square vendors inline — not moved to integrations hub (by design; setup remains readiness-focused).
3. **Vendor nav** does not yet link to `/integrations` hub explicitly; reachable via setup and Square integration back-link.
4. **Square admin Menu/POS refresh** label exists in registry but no Square-specific admin refresh section yet (Deliverect-only section retained).
5. **Toast** placeholder metadata only — no enum value wired in Prisma routing mode today.

---

## Acceptance criteria

| Criterion | Status |
|-----------|--------|
| Square vendors do not see Deliverect-labeled pages/sections | ✓ |
| Deliverect vendors do not see Square injection copy unless Square connected | ✓ |
| Manual/tablet vendors do not see POS provider requirements | ✓ |
| Menu imports page is generic and provider-aware | ✓ |
| Kitchen Mode copy is provider-aware | ✓ |
| Admin diagnostics are provider-aware | ✓ |
| No checkout/payout/injection/routing behavior changed | ✓ |
