# Menu import Phase 1B (persist draft only)

## A. Prisma schema (implemented)

- **Enums:** `MenuImportSource`, `MenuImportJobStatus`, `MenuImportIssueSeverity` (`blocking` | `warning` | `info`), `MenuImportIssueKind` (`normalization` | `validation`), `MenuVersionState`.
- **`MenuImportJob`:** vendor, source, status, optional Deliverect correlation + `idempotencyKey`, optional `draftVersionId` → `MenuVersion`, error fields, timestamps.
- **`MenuImportRawPayload`:** one per job (`jobId` unique), `payload` JSON, `payloadSha256`, optional `deliverectApiVersion`.
- **`MenuImportIssue`:** per-job rows mirroring `MenuImportIssueRecord` (+ waiver fields for later).
- **`MenuVersion`:** `canonicalSnapshot` + `canonicalSnapshotSha256`, `state`, `previousPublishedVersionId`, optional **`restoredFromMenuVersionId`** (rollback audit: new published row points at the archived source snapshot row).

Migrations: `prisma/migrations/20250319120000_menu_import_phase1b/migration.sql`, `prisma/migrations/20250323100000_menu_version_rollback_audit/migration.sql`.

Run: `npx prisma migrate deploy` (or `db:migrate` in dev).

## B. Service boundaries

| Function / module | Responsibility |
|-------------------|----------------|
| `src/lib/menu-import-payload-hash.ts` | `stableStringify` + `payloadFingerprint` (raw + canonical SHA-256). |
| `src/integrations/deliverect/menu/phase1a-pipeline.ts` | In-memory normalize + validate (unchanged). |
| `src/services/menu-import-phase1b.service.ts` | `ingestDeliverectMenuImportPhase1b`: vendor check → tx(raw+job) → Phase 1A → tx(issues + optional `MenuVersion` draft + job status). Optional **`normalizationRaw`** when the stored verbatim body differs from the JSON shape Phase 1A expects (e.g. Commerce menus array envelope). |
| `src/integrations/deliverect/menu-api.ts` | `fetchDeliverectCommerceStoreMenus` — `GET /commerce/{accountId}/stores/{storeId}/menus`; `pickNormalizerInputFromCommerceMenusResponse` for unwrap. |
| `src/services/deliverect-menu-pull-ingest.service.ts` | `pullDeliverectMenuAndIngestPhase1b` — load vendor Deliverect ids → GET menu → Phase 1B ingest. |
| `POST /api/admin/vendors/{vendorId}/menu-import/deliverect-pull` | Admin-only manual pull (see `DELIVERECT_SANDBOX.md`). |
| `POST /api/webhooks/deliverect/menu` | Menu Update webhook → same HMAC as order webhook → Phase 1B (`DELIVERECT_MENU_WEBHOOK`). |
| `src/domain/menu-import/canonical-diff.ts` | `diffCanonicalMenus(draft, published, publishedVersionId)` — Deliverect id–based diff of two canonical snapshots (admin only). |
| `/admin/menu-imports/[jobId]` | Includes **Draft vs published**: draft job snapshot vs latest `MenuVersion` with `state: published` for the same vendor. |
| `src/services/menu-publish-from-canonical.service.ts` | Guarded publish: draft canonical → live `MenuItem` / modifier tables; archives prior published snapshot row. |
| `POST /api/admin/menu-imports/[jobId]/publish` | Admin-only publish. |
| `src/services/discard-draft-menu-version.service.ts` | **Discard draft:** deletes `MenuVersion` only when `state: draft`; unlinks `MenuImportJob.draftVersionId`, sets job `cancelled` + `errorCode: DRAFT_DISCARDED`; keeps job, issues, raw payload. |
| `POST /api/admin/menu-imports/[jobId]/discard-draft` | Admin-only discard linked draft (confirmation in UI). |
| `src/domain/menu-import/canonical-menu-summary.ts` | `getCanonicalMenuSummaryCounts` — parse snapshot for admin counts (history UI). |
| `src/lib/admin-vendor-menu-history-queries.ts` | `fetchVendorMenuVersionHistoryForAdmin` — published + archived rows + summaries. |
| `src/services/menu-rollback-published.service.ts` | `rollbackVendorPublishedMenu` — archive current published, **create** new published row (copy of archived snapshot), `restoredFromMenuVersionId`, `applyCanonicalMenuToLiveTables`. |
| `POST /api/admin/vendors/{vendorId}/menu-versions/rollback` | Admin-only rollback (`sourceMenuVersionId` = archived `MenuVersion` id). |
| `/admin/vendors/{vendorId}/menu-history` | Published history + rollback confirmation (read-only menus). |

Optional **`deps.prisma`** for tests / alternate clients.

Errors: **`MenuImportVendorNotFoundError`** when `vendorId` is missing.

## C. Draft-only persistence flow

1. **Idempotency:** if `idempotencyKey` matches an existing job, return **`mapExistingJobToResult`** (no new writes).
2. **Tx 1:** create `MenuImportJob` (`status: ingested`) + `MenuImportRawPayload` (full raw JSON + fingerprint).
3. **Run** `runPhase1aDeliverectMenuImport` (no DB).
4. **Tx 2:** set job `validating` → `createMany` issues (if any) → if canonical menu passes **re-parse** with `mennyuCanonicalMenuSchema`, `create` `MenuVersion` (`draft`) and link `draftVersionId`, set job `awaiting_review` (with optional `errorMessage` if `phase1.ok` is false); else set `failed` / `NO_CANONICAL_MENU` or `CANONICAL_SNAPSHOT_INVALID`.
5. **No** writes to `MenuItem`, `ModifierGroup`, or `ModifierOption`.

**`Phase1bIngestResult.ok`:** `awaiting_review` **and** zero **blocking** persisted issues **and** Phase 1A `ok` (fresh) or same via idempotent read.

## D. Tests

- `npm test` — Vitest.
- **Phase 1A:** `src/integrations/deliverect/menu/phase1a-pipeline.test.ts` (sample JSON, bad root, empty products, duplicate product id).
- **Hash:** `src/lib/menu-import-payload-hash.test.ts`.
- **Phase 1B:** `src/services/menu-import-phase1b.service.test.ts` (mocked `PrismaClient`: happy path, empty products, idempotency, missing vendor).
