# Menu Architecture Phase 2 Migration Report

**Date:** 2026-07-24  
**Based on:** `docs/reports/menu-architecture-integration-neutral-audit.md`  
**Scope:** Additive schema, TS renames, dual-read/write location, identity helpers, PEM hybrid fields, diagnostics, enforcement tests  
**Not in scope:** Phase 3 (remove legacy columns / rename Prisma fields)

---

## Exact schema additions

### `MenuImportJob`
| Column | Type | Notes |
|--------|------|-------|
| `sourceLocationId` | `TEXT` nullable | Generic import location id |
| Index | `MenuImportJob_sourceLocationId_idx` | |

`deliverectLocationId` **retained** (deprecated in schema comments).

### `ProviderEntityMapping` (hybrid ExternalMenuMapping — no new table)
| Column | Type | Notes |
|--------|------|-------|
| `environment` | `TEXT` nullable | e.g. sandbox/production |
| `externalParentId` | `TEXT` nullable | e.g. Square ITEM id for a variation |
| `externalAccountId` | `TEXT` nullable | e.g. Square merchant id |
| `externalVersion` | `TEXT` nullable | |
| `metadata` | `JSONB` nullable | Non-secret diagnostics only |
| Index | `(vendorId, provider, externalParentId)` | |

`externalLocationId` already existed.

### Migration
- File: `prisma/migrations/20260724180000_menu_architecture_phase2_additive/migration.sql`
- Status: applied (after hotfix for wrong enum name `DELIVERECT_API_PULL`)

### Rollback (additive only)
```sql
DROP INDEX IF EXISTS "ProviderEntityMapping_vendorId_provider_externalParentId_idx";
ALTER TABLE "ProviderEntityMapping" DROP COLUMN IF EXISTS "metadata";
ALTER TABLE "ProviderEntityMapping" DROP COLUMN IF EXISTS "externalVersion";
ALTER TABLE "ProviderEntityMapping" DROP COLUMN IF EXISTS "externalAccountId";
ALTER TABLE "ProviderEntityMapping" DROP COLUMN IF EXISTS "externalParentId";
ALTER TABLE "ProviderEntityMapping" DROP COLUMN IF EXISTS "environment";

DROP INDEX IF EXISTS "MenuImportJob_sourceLocationId_idx";
ALTER TABLE "MenuImportJob" DROP COLUMN IF EXISTS "sourceLocationId";
```
Then `prisma migrate resolve` / restore migration history as needed. No historical orders rewritten.

---

## Compatibility read/write matrix

| Field / concern | New write | Legacy write | Read path |
|-----------------|-----------|--------------|-----------|
| Import location (Square) | `sourceLocationId` only | **Never** `deliverectLocationId` | `jobSourceLocationId()` prefers new, falls back legacy |
| Import location (Deliverect) | Dual-write both | Continues `deliverectLocationId` | Same helper |
| Canonical product id | Snapshot still `deliverectId` | unchanged | `productExternalId()` |
| Live MenuItem id | Still `deliverectProductId` column | unchanged | `menuItemSourceEntityId()` |
| Variant leaf | Still `deliverectVariantParentPlu` | Square must stay null | `isVariantLeafProduct` / `isVariantLeafMenuItem` |
| Square parent ITEM | Snapshot `sourceParentExternalId` | + PEM `externalParentId` on re-import | Mapping / diagnostics |
| Types | `OpenOrderCanonical*` | Deprecated `MennyuCanonical*` aliases | Prefer OpenOrder* |

---

## Files changed (high level)

### Schema / migration
- `prisma/schema.prisma`
- `prisma/migrations/20260724180000_menu_architecture_phase2_additive/migration.sql`

### Domain
- `src/domain/menu-import/canonical.schema.ts` — OpenOrder* names + aliases
- `src/domain/menu-import/canonical-identity.ts` — expanded helpers + job location dual-read
- `src/domain/menu-import/menu-import-job-location.ts` — dual-write policy
- `src/domain/menu-import/customer-menu-browse.ts` — helper-only leaf reads
- `src/domain/menu-import/index.ts` — exports
- `src/domain/menu-import/phase2-provider-field-enforcement.test.ts` — new
- Broad TS rename: Mennyu* → OpenOrder* across ~50 files (aliases retained)

### Import / mapping / publish / storefront
- `src/lib/integrations/square/square-menu-import.service.ts`
- `src/services/menu-import-phase1b.service.ts`
- `src/lib/integrations/provider-mapping.service.ts`
- `src/services/menu-publish-from-canonical.service.ts`
- `src/services/vendor-customer-menu.service.ts`
- `src/components/menu-import/MenuImportAdvancedDetails.tsx`
- Vendor/admin menu-import job pages (pass `sourceLocationId`)

### Diagnostics
- `src/lib/admin-menu-architecture-consistency.server.ts`
- `src/app/admin/(dashboard)/menu-architecture-consistency/page.tsx`
- `src/app/api/admin/menu-architecture-consistency/route.ts`

---

## Backfill results (this environment)

| Metric | Count |
|--------|------:|
| `MenuImportJob` total | 72 |
| With `sourceLocationId` after backfill | 72 |
| Square jobs with legacy location only | 0 |
| Deliverect jobs missing both location fields | 0 |
| Ambiguous other sources (reported, not guessed) | 0 |
| PEM rows with `externalParentId` | 0 (populated on next Square re-import) |

Ambiguous policy: only backfill when `source` is unambiguously Square or Deliverect. Other sources left alone and reported.

---

## Remaining legacy reads (intentional until Phase 3)

| Area | Why still present |
|------|-------------------|
| Deliverect transform / cart-deliverect-variant-resolution | Provider routing / nesting (**A/D**) — may read leaf PLU fields |
| Square order mapper | Reads `deliverectProductId` as PEM internal key (**D**) — namespaced Square ids |
| Snapshot JSON keys `deliverectId`, `menu.deliverect` | Persisted contract; dual-key later |
| Prisma column names | Additive phase only |
| Deprecated `MennyuCanonical*` aliases | Compat re-exports |

Generic modules enforced **not** to directly property-read leaf fields:
`menu-publish-from-canonical`, `vendor-customer-menu`, `vendor-customer-menu-cache`, `customer-menu-browse`.

---

## Tests run

```
npx vitest run src/domain/menu-import …
  + square normalizer / multi-variation / import service
  + menu-import-publish-eligibility
  + menu-parity.analyze
  + deliverect phase1a-pipeline
```

**Result: 9 files, 64 tests passed** (includes new Phase 2 enforcement suite).

Enforcement coverage:
- Square normalization cannot set leaf PLU/name
- Square import writers never `deliverectLocationId: locationId`
- Manual menus need no mapping for browse
- Deliverect leaves still excluded from browse
- Generic modules have no direct `.deliverectVariantParentPlu` / `Name` reads

---

## Mapping contract (chosen)

**Keep and evolve `ProviderEntityMapping`** as the hybrid ExternalMenuMapping. Do **not** add a competing table.

Required identity: `(vendorId, provider, internalEntityType, internalEntityId, externalLocationId)` → `externalId`  
Optional Phase 2: `externalParentId`, `externalAccountId`, `environment`, `externalVersion`, `metadata`.

---

## Recommendation for Phase 3

1. Introduce explicit `isVariantLeaf` (or stop using PLU field name in generic code paths entirely after dual-write).
2. Dual-write optional snapshot keys (`sourceExternalId`) while keeping `deliverectId`.
3. Prove zero dual-read fallbacks for `sourceLocationId` (diagnostics clean).
4. Only then expand/contract rename of Prisma columns and delete deprecated aliases.
5. Do **not** delete `deliverectVariantParentPlu` until Deliverect transform is migrated to a namespaced Deliverect DTO.

**Do not start Phase 3 until** PEM parent backfill + Square re-import have run on production-like data and consistency page is clean for Poke Sea / Deliverect vendors.

---

## How to use diagnostics

- UI: `/admin/menu-architecture-consistency` (optional `?vendorId=`)
- JSON: `GET /api/admin/menu-architecture-consistency?vendorId=…` (platform admin session)
