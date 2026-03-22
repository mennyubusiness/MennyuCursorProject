# Menu import Phase 1B (persist draft only)

## A. Prisma schema (implemented)

- **Enums:** `MenuImportSource`, `MenuImportJobStatus`, `MenuImportIssueSeverity` (`blocking` | `warning` | `info`), `MenuImportIssueKind` (`normalization` | `validation`), `MenuVersionState`.
- **`MenuImportJob`:** vendor, source, status, optional Deliverect correlation + `idempotencyKey`, optional `draftVersionId` → `MenuVersion`, error fields, timestamps.
- **`MenuImportRawPayload`:** one per job (`jobId` unique), `payload` JSON, `payloadSha256`, optional `deliverectApiVersion`.
- **`MenuImportIssue`:** per-job rows mirroring `MenuImportIssueRecord` (+ waiver fields for later).
- **`MenuVersion`:** `canonicalSnapshot` + `canonicalSnapshotSha256`, `state` (Phase 1B uses `draft` only), optional publish/rollback chain fields.

Migration: `prisma/migrations/20250319120000_menu_import_phase1b/migration.sql`.

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
