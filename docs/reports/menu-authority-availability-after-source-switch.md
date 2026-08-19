# Menu availability after Square/Deliverect → Open Order switch

**Date:** 2026-08-19  
**Status:** Implemented

## Root cause

Three concepts were collapsed into one:

| Concept | Actual fields | What went wrong |
|---|---|---|
| Original source | `sourcePayloadKind`, `sq:prod:` / Deliverect ids | Treated as *current* catalog owner |
| Current menu authority | `orderRoutingMode` → `manual_dashboard` ⇒ provider `open_order` | Switch code retired the live imported catalog |
| Customer availability | `MenuItem.isAvailable` (sold-out / snooze) | Switch set this `false` for every non-`oo:prod:` row |

On Square or Deliverect → tablet (`manual_dashboard`), `reconcileVendorMenuSourceOwnership` previously:

1. Archived published Square/Deliverect `MenuVersion`s (origin ≠ `open_order_builder_v1`)
2. Soft-disabled all live items that were not `oo:prod:…`

Menu Builder only lists `oo:prod:` draft rows, so those can look published/complete and not sold out.

Storefront and setup readiness load the **active catalog snapshot** via `loadActiveMenuVersionForVendor`, then overlay `MenuItem.isAvailable`. After the switch they still saw the imported catalog (or its archived fallback) with every item disabled.

Exact setup copy — “Menu items exist but none are available right now.” — is `hasOperationalItems && !hasAvailableOperationalItems` in `src/lib/vendor-pod-readiness.ts`, fed by `loadVendorMenuReadinessSummaries`.

This is **not Square-only**. Deliverect used the same retire-and-disable path.

## Affected fields and functions

- `src/services/vendor-menu-source-ownership.service.ts` — switch + repair
- `src/lib/vendor-active-menu-version.server.ts` — which snapshot is live
- `src/lib/vendor-menu-source.ts` — authority vs origin helpers
- `src/lib/vendor-menu-readiness.server.ts` — dashboard/setup
- `src/services/vendor-customer-menu-cache.service.ts` — storefront overlay
- `src/services/vendor-customer-menu.service.ts` — fallback row filter
- `src/services/admin-vendor-rescue.service.ts` — routing switch transaction

Authoritative customer flag remains **`MenuItem.isAvailable`**. There is no separate `isSoldOut`. Canonical `product.isAvailable` is the snapshot of that same idea from last provider publish.

## Fix (smallest architecture)

**Authority follows routing. Origin may stay Square/Deliverect.**

When switching **to** Open Order (`manual_dashboard`):

- Do **not** archive or disable the imported catalog.
- Unarchive the adopted snapshot if needed.
- Restore `MenuItem.isAvailable = true` only for snapshot products with `isAvailable: true`.
- Leave snapshot-unavailable / sold-out products disabled.
- Do **not** rewrite ids or drop PEM mappings.

When a native `open_order_builder_v1` publish already exists, it still wins; Square/Deliverect catalogs are not restored over it.

When switching **to** Square or Deliverect, other catalogs are still retired so menus do not merge. Actively Square- or Deliverect-managed vendors are unchanged.

Runtime:

- `loadActiveMenuVersionForVendor` for provider `open_order` prefers native builder, else adopted Square/Deliverect (published then archived).
- Storefront overlay uses the operational **winner** row’s `isAvailable`, not `every()` across duplicates.
- Fallback listing uses `menuItemAllowedUnderCurrentAuthority` so Square/Deliverect origin ids are valid under Open Order authority.

## Existing vendors

Already-switched vendors need a **one-time repair** (no schema migration):

```bash
npm run menu:repair-source-ownership
npm run menu:repair-source-ownership:execute
npx tsx scripts/repair-vendor-menu-source-ownership.ts --vendor=<id> --execute
```

Repair now includes tablet vendors **without** a native builder publish, even if `menuSource` already says `open_order` and the provider catalog is archived. That was the previous skip that left affected vendors broken.

Republishing the menu is not required.

## Surfaces

After repair, dashboard/setup, storefront, and operational scope all read the same adopted (or native) snapshot plus `MenuItem.isAvailable`.

Menu Builder still **edits** `oo:prod:` drafts. Until a native builder menu is published, customers see the adopted Square/Deliverect catalog. That catalog is now Open Order–controlled for availability.

## Tests

Coverage in:

- `src/services/vendor-menu-source-ownership.service.test.ts`
- `src/lib/vendor-active-menu-version.server.test.ts`
- `src/lib/vendor-menu-source.test.ts`
- `src/services/vendor-customer-menu-cache.service.test.ts`
- `src/services/admin-vendor-order-routing.test.ts`
