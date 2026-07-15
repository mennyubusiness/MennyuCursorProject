# Square multi-vendor mapping failure — diagnosis

**Date:** 2026-07-15  
**Scope:** Diagnostics only (no routing behavior change)

## Summary

The multi-vendor order failed on **Poke Sea** because ordered `MenuItem.deliverectProductId` values were Square catalog IDs mapped only at an **old** Square location (`LNQCZRWXMCFE2`), while the active Square connection selected location was **`LN7RT05NHEW13`**. Injection looks up mappings by `vendorId + internalEntityId + selected externalLocationId`, so those line items failed. **Iron Skewer Grill** succeeded with a clean single-location mapping set on a different merchant/location. This was **not** cross-vendor connection leakage.

## Incident order

| Field | Value |
|-------|--------|
| Order ID | `cmrh09p0j000lieq6vqgn0raw` |
| Created | 2026-07-11T23:38:30Z |
| Iron Skewer VO | `cmrh09pah0017ieq6x6oak2cq` → `routingStatus=confirmed`, Square order `038zPMlTKXzbZrdduuzwiI8PiiNZY` |
| Poke Sea VO | `cmrh09p1l000nieq6rsx1m7le` → `routingStatus=failed` |

**Stored Poke Sea error (actual):**  
`No active Square mapping for menu item "Salmon Avocado Hand Roll".` (and 8 more items) — mapper-level failure, not the readiness string.

No VendorOrders were found with the exact readiness phrase  
`No active Square item mappings for the selected location.`  
That readiness check counts *any* active item mappings at the selected location; it can pass even when specifically ordered items lack mappings.

---

## 1) Poke Sea diagnostics (current)

| Field | Value |
|-------|--------|
| vendorId | `cmr2ilw3i00004kemyftkdx89` |
| vendorName | Poke Sea |
| orderRoutingMode | `square` |
| active Square connection ID | `cmrb13dhv0003l88usqd7w511` |
| externalMerchantId | `MLXJSJ4WYQJPD` |
| externalLocationId (selected) | `LN7RT05NHEW13` |
| connection status | `connected` |
| credential ref present | `true` |
| active Square connection count | `1` |
| publishedMenuVersionId | `cmrh0m40e001r6tmg0zqmj4nd` |
| published sourcePayloadKind | `square_catalog_v1` |
| active published item count | `40` |
| active Square mappings @ selected location | `48` total (`40` items, `0` modifiers) |
| mappings @ other location `LNQCZRWXMCFE2` | `53` total (`40` items) |
| mappings by connectionId | all on `cmrb13dhv0003l88usqd7w511` (`101`) |
| mappingsExistForAnotherLocation | **true** |
| first 10 unmapped published items (selected loc) | none |

JSON admin route: `/admin/vendors/cmr2ilw3i00004kemyftkdx89/square-routing-debug`

---

## 2) Iron Skewer Grill diagnostics (current)

| Field | Value |
|-------|--------|
| vendorId | `cmqtoye3i0001smo1qt9js0j9` |
| vendorName | Iron Skewer Grill |
| orderRoutingMode | `square` |
| active Square connection ID | `cmrgxvvvc0005kfs8k2ycsi9b` |
| externalMerchantId | `MLV1ND28KEF9G` (**different merchant**) |
| externalLocationId | `L7186BQTYQC6X` (**different location**) |
| connection status | `connected` |
| credential ref present | `true` |
| active Square connection count | `1` |
| published sourcePayloadKind | `square_catalog_v1` |
| active published item count | `25` |
| active Square item mappings @ selected location | `25` |
| mappingsExistForAnotherLocation | **false** |

JSON admin route: `/admin/vendors/cmqtoye3i0001smo1qt9js0j9/square-routing-debug`

---

## 3) Failed VendorOrder item analysis (Poke Sea)

All 9 ordered products:

- Have active mappings **only** at old location `LNQCZRWXMCFE2`
- Have **zero** mappings at selected location `LN7RT05NHEW13`
- Those old catalog IDs are **absent** from the current published Square menu
- Same item names now exist under **new** `sq:prod:…` IDs in the published menu / live available MenuItems

Example:

| Name | Ordered MenuItem product ID | Mapping locations | Current live MenuItem product ID |
|------|-----------------------------|-------------------|----------------------------------|
| Salmon Avocado Hand Roll | `sq:prod:HX5FXYOCISNWPVPWCGV3PORO` | old only | `sq:prod:NJTTZBND77QCM3NHUH66EQMX` |
| Ahi Tuna Hand Roll | `sq:prod:6W3JS4OT2UPC6JTNTSU4CIPZ` | old only | `sq:prod:FOL5WTPPG6QIG3CV7ATKBTOP` |
| Spicy Edamame | `sq:prod:QD5BTUI3DNOHBK2KLJS4OHD5` | old only | `sq:prod:RBUUGAADNN4DNP2DXFWKGVJS` |

Timeline:

1. **23:38:30Z** — multi-vendor order placed against then-live MenuItems (old catalog IDs).
2. Injection used selected location `LN7RT05NHEW13` → no mappings for those IDs → fail.
3. **23:48:44Z** — Square menu republished (~10 minutes later); new MenuItems/IDs become live; old rows marked unavailable.
4. Current readiness/mappings for Poke Sea look healthy for **new** orders; stale old-location mappings remain.

---

## 4) Hypothesis checklist

| Hypothesis | Verdict |
|------------|---------|
| Wrong vendor scoping (Iron Skewer mappings/connection used for Poke Sea) | **Rejected** — distinct vendorIds, merchants, locations; queries include `vendorId` |
| Wrong Square connection (cross-account) | **Rejected** — Poke Sea remains on merchant `MLXJSJ4WYQJPD` |
| Wrong Square location | **Confirmed (primary)** — ordered items mapped at `LNQCZRWXMCFE2`, injection uses `LN7RT05NHEW13` |
| Stale/old connectionId | **Unlikely** — single active connection throughout; same connectionId holds both location mapping buckets |
| Mappings inactive/missing | **Partially** — not missing globally; missing **for selected location + ordered product IDs** |
| Published menu not Square-imported | **Rejected** — `square_catalog_v1` |
| Sandbox reconnection / session mistake after 2nd vendor | **Indirect** — adding 2nd vendor coincided temporally, but failure is location/catalog drift on Poke Sea, not shared connection |

---

## 5) Unsafe / weak query review

| Query | Risk | Notes |
|-------|------|-------|
| `getActiveSquareConnectionForVendor(vendorId)` — `findFirst` + `orderBy updatedAt desc` | Medium (same vendor) | Vendor-scoped, but ambiguous if multiple active Square rows exist |
| `countActiveSquareMappings(vendorId, locationId)` | Low | Correctly includes `vendorId`; if `locationId` null, counts all locations |
| `getProviderEntityMapping` / import upsert | Low | Always vendor + location scoped |
| `findMappingsByExternalId({ vendorId? })` | High if used without vendorId | **Optional vendorId**; no current production callers found under `src/` |
| `findVendorOrderIdBySquareOrderId` | Low | Global by Square order id (expected uniqueness) |
| Readiness `activeItemMappingCount > 0` | **Logic gap** | Passes if *any* items mapped at location; does not verify ordered MenuItems map |

**No evidence of a query picking “first Square connection in the DB” without vendorId.**

---

## 6) Diagnostics added (behavior unchanged)

1. Expanded `/admin/vendors/[vendorId]/square-routing-debug` + admin panel with connection/location/mapping breakdowns, unmapped published items, samples (no secrets).
2. On readiness failure containing “No active Square item mappings for the selected location,” attach `mappingFailureDiagnostics` to `lastSquarePayload` (and surface on admin order Square details / order debug). Order routing success/failure path unchanged aside from richer audit JSON on that specific failure.
3. For mapper-stage failures (as in this incident), existing `mappingIssues` remain; admin order debug can still compute live `mappingFailureDiagnostics` when the readiness string is present.

---

## 7) Recommended fix (do not implement yet)

1. **Operational (immediate):** For Poke Sea, deactivate/clean mappings for non-selected location `LNQCZRWXMCFE2`, and confirm only the selected location remains. Re-import/publish after any location change before accepting orders.
2. **Product:** On Square location change, require/automate menu re-import + publish and warn when `mappingsExistForAnotherLocation`.
3. **Readiness:** Strengthen gate from “any item mapping count > 0” to “all currently available MenuItems with Square product IDs have an active mapping at the selected location” (or sample + % coverage).
4. **Injection messaging:** Keep per-item mapper errors; optionally also stamp `mappingFailureDiagnostics` whenever mapper reports `MISSING_ITEM_MAPPING` (not only readiness string).
5. **Do not** change checkout, payouts, Deliverect, or manual routing.

---

## Verdict

**Root cause:** Poke Sea selected Square location / catalog remapping drift — ordered items still referenced old Square product IDs that only exist on the previous location’s `ProviderEntityMapping` rows. Multi-vendor checkout exposed this because Iron Skewer was healthy while Poke Sea was mid-location/catalog transition.
