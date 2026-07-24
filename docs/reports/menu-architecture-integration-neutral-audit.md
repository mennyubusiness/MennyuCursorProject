# OpenOrder Menu Architecture Audit — Integration-Neutral Domain

**Date:** 2026-07-24  
**Scope:** Menu identity, import/publish, storefront browse, cart/modifiers, external mappings, order routing  
**Trigger:** Square multi-variation items were hidden after publish because Square parent ITEM ids were stored in `deliverectVariantParentPlu`, a Deliverect-only browse/routing field.

---

## Executive summary

OpenOrder already has a **shared canonical menu shape** (`OpenOrderCanonicalMenu`) and a **shared publish/storefront pipeline**. All three producers — Deliverect, Square, and the manual Open Order builder — emit that shape.

The architectural debt is that the shared shape and live DB columns use **Deliverect-first names** (`deliverectId`, `deliverectProductId`, `menu.deliverect`, `deliverectVariantParentPlu`, …). Those names encode **provider-specific semantics** that generic layers then interpret incorrectly when another provider reuses them.

| Finding | Severity |
|---------|----------|
| Stable product identity is named `deliverect*` but holds `sq:*` / `oo:*` / Deliverect ids | High (naming / ownership) |
| Browse visibility keys off `deliverectVariantParentPlu` (Deliverect leaf semantics) | High (proven production bug) |
| Square location written into `MenuImportJob.deliverectLocationId` | Medium (F-class reuse) |
| Square source meta nested under `menu.deliverect` | Medium (F-class reuse) |
| `ProviderEntityMapping` already approximates ExternalMenuMapping for Square | Positive |
| Deliverect still uses embedded MenuItem columns as mapping SoT | Expected today; hybrid long-term |
| Shared import UI still says “Deliverect” for Square/manual jobs | Medium (UX / ops confusion) |

**Immediate fix already shipped (pre-audit):** Square no longer sets `deliverectVariantParentPlu`; parent ITEM id lives on `sourceParentExternalId` in the canonical snapshot. This audit defines the long-term domain and a phased migration so the class of bug cannot recur.

**This pass implements only Phase 1 (safe):** generic identity helpers, provider consistency diagnostics, source-aware UI copy, and regression tests. **No destructive schema migration; no legacy column deletes.**

### Phase 1 implementation status (completed in this change set)

| Deliverable | Location |
|-------------|----------|
| Identity helpers | `src/domain/menu-import/canonical-identity.ts` |
| `sourceProvider` derivation | `src/domain/menu-import/menu-source-provider.ts` |
| Consistency diagnostics | `src/domain/menu-import/menu-provider-consistency.ts` (+ import review UI) |
| Neutral shared import copy | `MenuImportPublishPanel`, IssuesList, ParityBanner, AdvancedDetails, DiffView, labels |
| Tests | `menu-provider-consistency.test.ts` (+ existing Square visibility suite) |
| Interactive summary | Cursor canvas `menu-architecture-audit.canvas.tsx` |

---

## 1. Inventory & classification legend

| Code | Meaning |
|------|---------|
| **A** | Deliverect-only integration concern |
| **B** | Square-only integration concern |
| **C** | Generic OpenOrder menu concern |
| **D** | Order-routing concern |
| **E** | Legacy naming (generic concept wearing a Deliverect name) |
| **F** | Incorrect cross-integration reuse |

---

## 2. Field ownership matrix

### 2.1 Canonical snapshot (`OpenOrderCanonicalMenu`)

| Field / concept | Class | Written by | Read by | Notes / risk |
|-----------------|-------|------------|---------|--------------|
| `products[].deliverectId` | **E** | All adapters | Publish, browse, diffs, storefront | Generic entity id; name is misleading |
| `categories[].deliverectId` | **E** | All adapters | Publish, storefront sections | Same |
| `modifierGroupDefinitions[].deliverectId` | **E** | All adapters | Publish, links | Same |
| `options[].deliverectId` | **E** | All adapters | Publish, Square PEM | Same |
| `productDeliverectIds` | **E** | All adapters | Browse, preview | Same |
| `menu.deliverect` meta object | **E / F** | All adapters | Source detection, Square readiness | Square/OO meta live under Deliverect-named bag |
| `sourcePayloadKind` | **C** | All adapters | Source routing | Real generic discriminator; wrong parent object name |
| `deliverectVariantParentPlu` / `Name` | **A** | Deliverect only (Square must be null) | Browse exclusion, cart nesting, Deliverect transform | **Must not** be used for Square parents |
| `sourceParentExternalId` | **B→C** | Square | Snapshot diagnostics / future mapping | Not on live `MenuItem` yet |
| `plu` / option `plu` | **A** | Deliverect | Deliverect orders, snooze | Square leaves null |
| `isVariantGroup` / `multiMax` | **A** (semantics) | Deliverect; optional elsewhere | Modifier kinds, Deliverect transform | Square typically unset |

### 2.2 Live tables (`MenuItem` / `ModifierGroup` / `ModifierOption`)

| Column | Class | Role |
|--------|-------|------|
| `MenuItem.deliverectProductId` | **E** | Upsert key + Square PEM `internalEntityId` |
| `MenuItem.deliverectPlu` | **A** | Deliverect PLU / snooze |
| `MenuItem.deliverectVariantParentPlu` / `Name` | **A** | Deliverect leaf → browse hide + cart/order nesting |
| `MenuItem.deliverectCategoryId` | **E** | Category link for live rows |
| `ModifierGroup.deliverectModifierGroupId` | **E** | Upsert identity |
| `ModifierGroup.deliverectIsVariantGroup` / `MultiMax` | **A** | Deliverect nesting rules |
| `ModifierOption.deliverectModifierId` | **E** | Upsert + Square PEM |
| `ModifierOption.deliverectModifierPlu` | **A** | Deliverect outbound PLU |

### 2.3 Import / job / vendor

| Field | Class | Notes |
|-------|-------|-------|
| `MenuImportJob.source` | **C** | Discriminator (`SQUARE_CATALOG_PULL`, `DELIVERECT_*`, …) |
| `MenuImportJob.deliverectChannelLinkId` | **A** | Deliverect-only |
| `MenuImportJob.deliverectLocationId` | **F** when Square | Square writes Square location id here today |
| `MenuImportJob.deliverectMenuId` | **A** | Deliverect-only |
| `MenuImportIssue.deliverectId` | **E / F** | Square writes `squareObjectId` into it |
| `Vendor.menuSource` | **C** (incomplete) | Enum is only `open_order` \| `deliverect`; Square runs as `open_order` + `orderRoutingMode=square` |
| `Vendor.orderRoutingMode` | **D** | Separates routing provider from menu ownership (good) |
| `ProviderEntityMapping.*` | **C** | Square ExternalMenuMapping spine |
| `VendorIntegrationConnection.externalLocationId` | **C** | Correct generic location |

### 2.4 Browse / storefront / cart

| Concept | Class | Notes |
|---------|-------|-------|
| `computeCustomerMenuBrowseExcludedProductIds` | **C** with **A**-shaped rule | Excludes products with variant-parent PLU set — correct for Deliverect leaves; catastrophic if Square reuses the field |
| Storefront section builder | **C** | Should never branch on provider |
| Cart variant resolution (`cart-deliverect-variant-resolution`) | **A / D** | Deliverect leaf merge; gated by Deliverect nesting rules for orders |
| Square order mapper | **D** | Reads `deliverectProductId` as Square internal key → PEM |

---

## 3. Risky cross-provider usages (F-class and proven bugs)

| # | Risk | Location | Status |
|---|------|----------|--------|
| 1 | Square parent ITEM id written as `deliverectVariantParentPlu` → storefront hide | Former Square normalizer | **Fixed** (null + `sourceParentExternalId`) |
| 2 | Square catalog ids stored in `deliverectId` / `deliverectProductId` | Square normalizer + publish | Ongoing **E**; rename later |
| 3 | Square location → `MenuImportJob.deliverectLocationId` | `square-menu-import.service.ts` | **F**; Phase 2 column/alias |
| 4 | Square warnings → `MenuImportIssue.deliverectId` | Same | **F**; Phase 2 |
| 5 | Square meta under `menu.deliverect` | Square normalizer | **F**; Phase 2 rename meta bag |
| 6 | Shared UI: “Fix in Deliverect” / “Removed items in Deliverect” | Menu import components | Phase 1 copy cleanup |
| 7 | Helpers named `isSquareProductDeliverectId` | `square-menu-ids.ts` | Phase 1 alias rename in TS |

**Invariant (must remain tested forever):**  
A field used for **order nesting / Deliverect leaf semantics** must not be overloaded as **generic parent external id**. Browse visibility must only depend on an explicitly modeled “variant leaf / non-browsable” flag — today that flag *is* `deliverectVariantParentPlu`, which is Deliverect-shaped.

---

## 4. Generic OpenOrder menu domain (target)

### 4.1 Core concepts

| Concept | Responsibility |
|---------|----------------|
| **Menu** (`MenuVersion` + canonical snapshot) | Versioned, vendor-owned catalog snapshot; draft vs published |
| **MenuCategory** | Browse grouping; ordered list of item identities |
| **MenuItem** | Customer-sellable SKU (price, availability, modifiers, image) |
| **MenuItemVariation** | *Not* a separate live table today. Square flattens variations into MenuItems. Deliverect models variations as leaf MenuItems under a parent shell. Retain as an **optional conceptual** distinction in adapters, not a required core table in Phase 1–2. |
| **ModifierGroup** / **ModifierOption** | Selection rules and priced choices |
| **MenuItemModifierGroup** | Link table: which groups apply to which item |
| **ExternalMenuMapping** | Provider ↔ internal entity mapping (see §6) |
| **MenuImport** / **MenuImportDraft** | Ingest job + draft `MenuVersion` |
| **MenuPublish** | Draft → live tables + published pointer |
| **Browse / orderability state** | Visibility on storefront vs cart/order eligibility (availability, snooze, mapping readiness) |

### 4.2 Core vs adapter-owned fields

**Core domain (generic):**  
name, description, priceCents, isAvailable, sortOrder, imageUrl, basketMaxQuantity, category membership, modifier group links, min/max/required selection rules, published/draft state, vendor ownership.

**Adapter-owned (must not leak into generic browse/cart rules unless explicitly modeled):**  
Deliverect PLU, channel link, variant parent PLU/name, `isVariantGroup` / `multiMax`, Square ITEM vs ITEM_VARIATION ids, Square location/merchant, OAuth connection ids, raw provider payloads.

**Explicitly modeled cross-cutting flags (generic):**  
`isVariantLeaf` / non-browsable (today implied by non-null variant parent PLU) — should become a **named generic boolean or enum** in Phase 2 so Deliverect can set it and Square never touches Deliverect PLU fields.

---

## 5. Generic external-source terminology (target)

| Prefer | Avoid for generic / Square / manual |
|--------|-------------------------------------|
| `sourceProvider` | Hardcoding “Deliverect” in shared UI |
| `sourceExternalId` | `deliverectId` as the public name |
| `sourceParentExternalId` | Storing parents in `deliverectVariantParentPlu` |
| `sourceLocationId` | `MenuImportJob.deliverectLocationId` for Square |
| `sourceAccountId` | Mixing merchant ids into menu columns |
| `sourceVersion` / `sourceMetadata` | Overloaded PLU columns |
| `externalMapping` / `ProviderEntityMapping` | Embedding all provider ids forever on MenuItem |

JSON snapshot keys and Prisma columns keep legacy names through Phase 3; TypeScript helpers and UI use the preferred terms from Phase 1.

---

## 6. Adapter boundaries

```text
┌─────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│ Deliverect      │  │ Square           │  │ Manual Open Order  │
│ catalog /       │  │ Catalog API      │  │ builder input      │
│ webhook         │  │                  │  │                    │
└────────┬────────┘  └────────┬─────────┘  └─────────┬──────────┘
         │                    │                      │
         ▼                    ▼                      ▼
   normalizeDeliverect   normalizeSquare      buildOpenOrderCanonical
         │                    │                      │
         └────────────────────┼──────────────────────┘
                              ▼
                    OpenOrderCanonicalMenu (generic draft)
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   Import review         Publish pipeline    Browse diagnostics
   Draft diff            Live MenuItem*      (generic exclusions)
         │                    │
         ▼                    ▼
   Storefront / cart / modifiers / checkout pricing
         │
         ├─ orderRoutingMode=deliverect → Deliverect transform (PLU / subItems)
         └─ orderRoutingMode=square     → Square mapper + ProviderEntityMapping
```

**Rule:** Generic layers consume only generic menu concepts. Provider branching is allowed only at:

1. Adapter normalizers (ingress)  
2. Order-routing adapters (egress)  
3. Provider-specific settings / diagnostics pages  

---

## 7. External mapping architecture recommendation

### Option A — Embedded fields only (status quo for Deliverect)

Pros: simple joins; publish upsert by column.  
Cons: every new POS adds columns or overloads `deliverect*`; proven semantic collisions.

### Option B — Mapping table only

Pros: clean provider isolation.  
Cons: large migration; every storefront/cart path must join mappings; Deliverect production risk.

### Option C — Hybrid (recommended)

| Concern | Home |
|---------|------|
| Stable internal upsert key on live rows | Keep thin embedded key (rename later to `sourceEntityId` / keep prefixed values) |
| Provider catalog object id + location + parent | `ProviderEntityMapping` (already exists) / evolve toward recommended shape |
| Deliverect PLU / leaf / variant-group | Stay Deliverect-specific (embedded or Deliverect side-car) — **never** reused by Square |
| Parent Square ITEM id | Mapping `externalParentId` or metadata; snapshot `sourceParentExternalId` until then |

**Recommended target mapping shape** (evolve `ProviderEntityMapping`, do not invent a parallel table in Phase 1):

- `vendorId`, `provider`, `environment`
- `externalAccountId`, `externalLocationId`
- `entityType`, `internalEntityId`, `externalId`, `externalParentId`
- `externalVersion`, `isActive`, `metadataJson`

**Safest long-term path:** Hybrid. Square already uses PEM for injection. Deliverect keeps embedded SoT until a deliberate dual-write. Do **not** auto-create a second mapping table now.

---

## 8. Routing separation

| Concern | Must not auto-control |
|---------|------------------------|
| Menu identity (`deliverectProductId` / future `sourceEntityId`) | Browse visibility |
| External mapping (PEM) | Browse visibility |
| Order-routing payload construction | Storefront tile list |
| `deliverectVariantParentPlu` (Deliverect leaf) | Square parent ITEM linkage |

**Explicit model:** “non-browsable / variant leaf” is a **menu presentation** concern. “parent external id for POS” is a **mapping** concern. They coincide for Deliverect leaves today; they must not for Square.

---

## 9. Naming cleanup (UI / code)

| Current | Replacement |
|---------|-------------|
| “Fix these in Deliverect…” | “Fix these in the source menu system…” / source-aware (“Square catalog” / “Deliverect” / “Open Order”) |
| “Removed items in Deliverect…” | “Removed items from the imported menu are marked unavailable, not deleted.” |
| “identical Deliverect ids” | “identical external catalog ids” |
| “Deliverect mapping” (parity banner, shared) | “External menu mapping” / “Published menu mapping” |
| `hideDeliverectIds` | `hideExternalIds` (alias) |
| Advanced “Deliverect” for location when Square | “Source location” / “Square location” |
| `productDeliverectId` in diagnostics | Keep JSON key; display “Source item ID” |

Keep “Deliverect” labels only on Deliverect connect, channel, pull, and Deliverect-only diagnostics.

---

## 10. Phased migration plan

### Phase 1 — Introduce generics; preserve behavior *(this pass)*

- Generic identity / provider helpers (TS)
- Consistency diagnostics (no secrets)
- Source-aware / neutral UI copy on shared import surfaces
- Regression tests (Square visibility, Deliverect leaves, manual menus, browse vs routing separation)
- **No DB migration; no column deletes; snapshot JSON keys unchanged**

**Rollback:** Revert code; no data migration to undo.

### Phase 2 — Writers + readers + backfill

- Dual-write optional generic fields in snapshot (`sourceProvider`, aliases) while keeping legacy keys
- Square/Deliverect/manual writers emit both
- Generic readers prefer new helpers
- Backfill diagnostics for mismatches
- Consider additive Prisma columns (`sourceEntityId` nullable) **only with dual-write** — separate approval

**Rollback:** Stop writing new fields; readers fall back to legacy keys. Additive columns remain nullable unused.

### Phase 3 — Remove generic dependencies on legacy Deliverect names

- Generic browse uses `isVariantLeaf` (or equivalent) rather than Deliverect PLU field name in code paths
- Deprecate reading `menu.deliverect` without helper
- Mark Prisma columns deprecated in schema comments

**Rollback:** Helpers still read legacy columns.

### Phase 4 — Delete / rename legacy fields

- Only after zero reads/writes proven (grep + telemetry + diagnostics clean)
- Rename/migrate DB columns with expand/contract
- **Requires explicit approval**

**Rollback:** Restore previous schema from backup; keep expand phase columns until contract proven.

---

## 11. Consistency checks (diagnostics)

Safe checks (no tokens / credentials):

1. Square-sourced products with non-null `deliverectVariantParentPlu`
2. Deliverect-sourced leaves missing parent PLU when snapshot expects leaves
3. `sourcePayloadKind` vs job `source` mismatch
4. Active PEM rows for non-selected Square location
5. Duplicate active PEM rows for same internal entity + location
6. Published items excluded from browse solely due to variant-parent metadata
7. Modifier groups linked only to unavailable/stale items

Implemented in Phase 1 as pure functions over canonical menus (+ optional PEM inputs later).

---

## 12. Exact files to change

### Phase 1 (safe — implemented / in this pass)

| Area | Files |
|------|-------|
| Domain helpers | `src/domain/menu-import/canonical-identity.ts` (new), `menu-source-provider.ts` (new), `menu-provider-consistency.ts` (new) |
| Browse copy | `src/domain/menu-import/customer-menu-browse.ts` |
| Shared UI | `MenuImportPublishPanel.tsx`, `MenuImportIssuesList.tsx`, `MenuParityAuditBanner.tsx`, `MenuImportMenuPreview.tsx`, `MenuImportAdvancedDetails.tsx`, `MenuImportBrowseExclusionDiagnostics.tsx` |
| Labels | `vendor-menu-import-labels.ts`, admin/vendor import pages (copy) |
| Tests | `canonical-identity.test.ts`, `menu-provider-consistency.test.ts`, extend Square/Deliverect browse tests |

### Phase 2+ (approval required for schema)

| Area | Files |
|------|-------|
| Canonical schema dual keys | `canonical.schema.ts` |
| Normalizers | `square-catalog-normalizer.ts`, `integrations/deliverect/menu/normalize.ts`, `open-order-menu-publish.service.ts` |
| Publish | `menu-publish-from-canonical.service.ts` |
| Jobs | `MenuImportJob` Prisma columns / Square import writer |
| Cart | Gradually route through `isVariantLeafProduct()` |
| PEM evolution | `provider-mapping.service.ts`, `schema.prisma` |

---

## 13. Tests to add / keep

| Test | Proves |
|------|--------|
| Square multi-variation visibility | Two variations visible; category remains; modifiers survive; PEM ids retained |
| Deliverect variant leaves | Still excluded from browse when parent PLU set |
| Manual / OO builder | No required external mapping fields for browse |
| Consistency diagnostic | Flags Square+parentPlu misuse |
| Generic publish identity helpers | Same external id accessors across providers |
| Browse vs routing | Parent external id ≠ browse exclusion |
| Stale PEM | Covered by existing Square mapping/location tests; keep |

---

## 14. Low-risk cleanup (Phase 1) vs high-risk (needs approval)

### Implement now (Phase 1)

- TS helpers: `productExternalId`, `isVariantLeafProduct`, `menuSourceProvider`, `menuSourceMeta`
- Neutral / source-aware UI strings on shared import panels
- Diagnostics for Square entities using Deliverect-only leaf fields
- Regression tests listed above
- Alias `hideExternalIds` → existing `hideDeliverectIds`

### Requires separate approval

- Prisma renames / new required columns
- Changing published snapshot JSON keys without dual-write
- Deleting `deliverect*` columns
- Moving Deliverect SoT fully into PEM
- Changing `Vendor.menuSource` enum (add `square`) without full call-site audit
- Making `MenuItemVariation` a first-class table

---

## 15. Recommended target schema (conceptual)

```text
MenuVersion { canonicalSnapshot /* generic */, state, … }

MenuItem {
  id, vendorId, name, priceCents, isAvailable, …
  sourceEntityId          // Phase 2+ rename of deliverectProductId (dual-write)
  isVariantLeaf           // Phase 2+ explicit; today derived from variant parent PLU
  // Deliverect-only (stay namespaced or side-car):
  deliverectPlu, deliverectVariantParentPlu, deliverectVariantParentName
}

ProviderEntityMapping / ExternalMenuMapping {
  vendorId, provider, environment,
  externalAccountId, externalLocationId,
  entityType, internalEntityId, externalId, externalParentId?,
  externalVersion?, isActive, metadataJson?
}
```

---

## 16. Decision record

| Decision | Choice |
|----------|--------|
| Long-term mapping | **Hybrid** — PEM for injection providers; thin embedded upsert keys; Deliverect-specific fields stay namespaced |
| Phase 1 schema | **No migration** |
| Browse control | Must not use provider parent-id fields; only explicit leaf/non-browsable semantics |
| Square parent ITEM | `sourceParentExternalId` (snapshot) → later PEM `externalParentId` |

---

## Appendix A — Provider boundary diagram (text)

See §6.

## Appendix B — Related incidents

- 2026-07-24: Square multi-variation storefront disappearance via `deliverectVariantParentPlu` overload.
- Prior: Square location / PEM drift (Poke Sea) — mapping table location scoping is correct; reinforces PEM as routing SoT.
