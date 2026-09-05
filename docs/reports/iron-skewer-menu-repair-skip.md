# Iron Skewer Grill — why menu-source repair returned `repairedCount: 0`

**Date:** 2026-08-19  
**Vendor:** `cmqtoye3i0001smo1qt9js0j9` (Iron Skewer Grill, `iron-skewer-grill`)  
**Status:** Investigation only — no data was modified

## Root cause (first)

The repair script skipped this vendor because **Open Order is already aligned and a native Menu Builder catalog is already published.**

Exact skip condition in `vendorNeedsOpenOrderAdoptionRepair`:

```ts
const menuSourceMismatch = input.menuSource !== expected; // false
const hasNativePublished = input.published.some((row) =>
  snapshotIsNativeOpenOrderBuilder(row.canonicalSnapshot)
); // true
return menuSourceMismatch || !hasNativePublished; // false → skip
```

Stored facts that produce that skip:

| Field | Value |
|---|---|
| `orderRoutingMode` | `manual_dashboard` |
| Expected `menuSource` | `open_order` |
| Persisted `menuSource` | `open_order` |
| Authority provider | `open_order` |
| Published `MenuVersion` | 1 row, `sourcePayloadKind = open_order_builder_v1` |

That eligibility rule assumes: *if a native builder menu is published, availability is already Open Order–controlled and needs no adoption/restore.*

That assumption is wrong for this vendor. The **winning catalog is native Open Order, and every product in it is unavailable** (`canonical product.isAvailable = false` and matching `MenuItem.isAvailable = false`). Dashboard and storefront are consistent with that data. Repair never looks at availability when a native publish exists.

This is **not**:

- a false-positive native-publish detection (the published snapshot really is `open_order_builder_v1`)
- a duplicate-row winner bug (each `oo:prod:` id has exactly one `MenuItem`)
- a cache/read-path disagreement (readiness and storefront select the same published native version)

It **is** incomplete repair eligibility plus a live native catalog that was published with all items unavailable.

## Current database state

### Vendor / authority

| Field | Value |
|---|---|
| `orderRoutingMode` | `manual_dashboard` (Open Order / tablet) |
| `menuSource` | `open_order` |
| Current menu authority | `open_order` |
| `posType` / `posProvider` | `clover` / `clover` (`posConnectionStatus = connected`) |
| `deletedAt` | null |

Routing and menu source already match. Repair had nothing to realign on those fields.

### MenuVersion records (newest first)

| id | state | publishedAt (UTC) | origin (`sourcePayloadKind`) | products | snapshot available |
|---|---|---|---|---|---|
| `cmqud83uf00075p6m89rkxo1a` | **draft** | — | `deliverect_menu_webhook_v1` | 21 | 21 |
| `cmt0g0bkk0002wot5cwk6bllm` | **published** | 2026-08-19 18:46:26 | `open_order_builder_v1` | 8 | **0** |
| `cmt0eaxwx00022eoe9l4x8r1m` | archived | 2026-08-19 17:58:42 | `open_order_builder_v1` | 8 | **0** |
| `cmslaxm0a000210s8ncprlcdn` | archived | 2026-08-09 04:27:49 | `open_order_builder_v1` | 8 | **0** |
| `cmrgzc38i00092z38en0261u9` | archived | 2026-07-11 23:12:50 | `square_catalog_v1` | 25 | 25 |
| several older `open_order_builder_v1` archived rows (Jun 30) | archived | Jun 30 | native builder | 8 | **8** |
| `cmqtxlqoh0008kcv3jjfgnfx7` | archived | 2026-06-25 20:05:39 | `deliverect_menu_webhook_v1` | 21 | 21 |

Native builder **does** exist and is the sole published catalog. From Aug 9 onward, every native snapshot has **0 available products**. Earlier native snapshots (Jun 30) had all 8 available. The Square catalog (Jul 11) still has 25/25 snapshot-available.

### MenuItem rows

54 live rows, **no duplicate `deliverectProductId`s**.

| Origin prefix | count | `isAvailable=true` | `isAvailable=false` |
|---|---|---|---|
| Deliverect (other) | 21 | 0 | 21 |
| `sq:prod:` | 25 | 0 | 25 |
| `oo:prod:` | 8 | 0 | 8 |

Builder categories: 3 `VendorMenuCategory` rows.

All 8 operational builder items match the published snapshot 1:1. Example: `Mediterranean Skewer` (`oo:prod:cmr04x3ng000bputiqzceclkn`) — snapshot `isAvailable=false`, single MenuItem `isAvailable=false`.

### Why Menu Builder can look “published and complete”

Menu Builder publish validation (`validateOpenOrderMenuBuilderState`) does **not** require any available items. `availableItemCount` is informational. `publishOpenOrderMenuFromBuilder` also does **not** use the import-path `NO_AVAILABLE_PRODUCTS` guard.

So a vendor can publish a structurally complete native menu while every item is `isAvailable=false`. Publish status then shows live (`hasPublishedOpenOrderMenu`), which matches “published and complete.” Sold-out toggles in builder are bound to the same `MenuItem.isAvailable` flag that is currently false in the database.

## Code path for this vendor

### 1. Repair eligibility

`repairInconsistentVendorMenuSourceOwnership`:

1. Load vendor → `manual_dashboard` / `open_order`
2. Load **published-only** MenuVersions → one `open_order_builder_v1`
3. `vendorNeedsOpenOrderAdoptionRepair` → **false**
4. `continue` → `repairedCount: 0`

It never inspects `MenuItem.isAvailable` or snapshot product availability.

Even if eligibility were true, `restoreAvailabilityFromAdoptedSnapshot` would copy **snapshot** `isAvailable`. The current native snapshot is all false, so a restore-from-winner would still leave every item unavailable.

### 2. Catalog winner (storefront + readiness)

`loadActiveMenuVersionForVendor` when provider is `open_order`:

1. Prefer published native builder
2. Else published Square/Deliverect
3. Else archived native / adopted

This vendor hits step 1: published native `cmt0g0bkk0002wot5cwk6bllm`.

That is the correct winner-selection rule given a native publish. Square’s archived 25-item catalog is intentionally not selected.

### 3. Dashboard / setup readiness

`loadVendorMenuReadinessSummaries`:

- `hasPublishedMenuVersion` = active snapshot parsed → **true**
- operational ids = 8 `oo:prod:` winner rows
- `hasOperationalItems` = **true**
- `hasAvailableOperationalItems` = any operational row with `isAvailable=true` → **false**

Setup copy: **“Menu items exist but none are available right now.”**

### 4. Storefront overlay

Display is built from the native snapshot (8 products). Overlay uses each product’s operational MenuItem `isAvailable`. All eight are false → every customer item unavailable. No duplicate-pool AND bug here (`matchingRowCount` is 1 for every product).

## Which of the five hypotheses?

| # | Hypothesis | Verdict |
|---|---|---|
| 1 | Repair eligibility is incomplete | **Yes.** Native publish + aligned `menuSource` is treated as healthy even when every native item is unavailable. |
| 2 | Runtime winner selection is still wrong | **No for this vendor.** Native published catalog should win. |
| 3 | Already repaired; stale cache/read path | **No.** Live rows and snapshot agree: all unavailable. |
| 4 | Native Open Order publish detected incorrectly | **No.** Kind is `open_order_builder_v1`; published at 2026-08-19 18:46 UTC. |
| 5 | Duplicate rows, wrong `isAvailable` wins | **No.** No duplicate product ids. |

## Likely history (not a second bug in winner selection)

1. Deliverect and Square catalogs were imported (21 and 25 items, snapshot-available).
2. A native 8-item builder menu existed and used to be available (Jun 30 snapshots).
3. From Aug 9, native snapshots are 8/8 unavailable — consistent with an earlier routing switch that soft-disabled Open Order items (`menuItemShouldRemainAvailable` keeps only the active **origin** prefix while Square/Deliverect own the menu), then a later publish that **baked** those false flags into `open_order_builder_v1`.
4. Square/Deliverect live rows remain disabled (expected after leaving those providers).
5. Repair was designed to adopt/restore **provider** catalogs when **no** native publish exists. This vendor already has a native publish, so it is skipped.

## What a correct follow-up would need (not applied)

Do **not** blindly set every item `available=true`.

A follow-up should treat “native published but zero available products, while an older native snapshot or builder intent says they were available” as a repair case — restore Open Order–controlled availability for **`oo:prod:` items that are the published native catalog**, without resurrecting retired Square/Deliverect rows, and without overriding items that are explicitly sold out *after* Open Order is already authority.

Until that exists, `menu:repair-source-ownership` will keep returning `repairedCount: 0` for this vendor.
