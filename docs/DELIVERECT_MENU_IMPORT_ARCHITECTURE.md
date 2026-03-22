# Deliverect-first menu import architecture

This document defines how Mennyu should import and evolve menus **with Deliverect as the upstream source of truth**, not as a generic CSV pipeline. It aligns with today’s Prisma models (`MenuItem`, `ModifierGroup`, `ModifierOption`, `Vendor.deliverect*`, `deliverectProductId`, `deliverectModifierId`) and extends them safely.

---

## A. Deliverect-first architecture (recommended)

### Principles

1. **No raw Deliverect JSON → live `MenuItem` rows.** Every change path goes: **ingest → store raw → normalize → validate → draft version → human/system gate → publish** (transactional apply).
2. **Identity is Deliverect-scoped:** match on **Deliverect external IDs** (product PLU/_id, modifier ids, bundle/category ids as Deliverect exposes them). Names are display metadata only.
3. **POS can overwrite Deliverect:** Mennyu treats **Deliverect’s API/webhook payload as authoritative for “what we last imported.”** Manual edits in Mennyu are either **blocked** for synced entities or stored as **explicit overrides** with clear precedence rules.
4. **Audit & rollback:** each publish creates a new **`MenuVersion` (published)**; previous published version remains addressable for rollback (re-publish prior snapshot or “restore” job).
5. **Two ingresses, one pipeline:** **Phase 1** pull (Deliverect REST menu endpoints); **Phase 2** push (Menu Update webhooks). Both produce **`MenuImportJob` + raw payload record + normalized draft `MenuVersion`**.

### Layering (services)

| Layer | Responsibility |
|--------|----------------|
| `deliverect/menu-client.ts` | HTTP fetch from Deliverect menu APIs; auth; pagination; no DB writes except via importer. |
| `deliverect/menu-webhook.ts` | Verify signature, persist raw event, enqueue job (idempotent). |
| `menu-import/raw-storage.ts` | Write/read `MenuImportRawPayload` (DB or object storage reference). |
| `menu-import/normalize.ts` | Deliverect JSON → **canonical `MennyuCanonicalMenu`** (pure function + Zod). |
| `menu-import/validate.ts` | Canonical → business rules (required modifiers, prices, pod constraints). |
| `menu-import/diff.ts` | Compare **published snapshot** vs **draft snapshot** (structural + id-level). |
| `menu-import/publish.ts` | Single DB transaction: apply canonical draft to live tables with `menuSource` / external ids; record `MenuVersion` published. |

---

## B. Schema direction (Prisma)

### B.1 New enums

```prisma
enum MenuImportSource {
  DELIVERECT_API_PULL
  DELIVERECT_MENU_WEBHOOK
  // future: DELIVERECT_BACKOFFICE_EXPORT, etc.
}

enum MenuImportJobStatus {
  queued
  fetching
  ingested
  normalizing
  validating
  awaiting_review
  publishing
  succeeded
  failed
  cancelled
}

enum MenuImportIssueSeverity {
  error    // blocks publish until resolved or waived
  warning  // publish allowed with acknowledgement
  info
}

enum MenuVersionState {
  draft      // working copy from an import job
  published  // currently live for vendor (at most one per vendor; see note)
  archived   // historical published snapshot kept for audit/rollback
  superseded // replaced by newer published (optional; or use archived only)
}

enum MennyuMenuEntitySource {
  DELIVERECT_SYNCED   // row derived from Deliverect; next sync may replace fields
  MENNYU_OVERRIDE     // explicit override layer (see B.4)
  MENNYU_MANUAL       // legacy / non-Deliverect vendor (until migrated)
}
```

**Note on “one published per vendor”:** enforce in application logic: publishing sets previous `published` → `archived` and links `previousVersionId`.

### B.2 `MenuImportJob`

```prisma
model MenuImportJob {
  id                String              @id @default(cuid())
  vendorId          String
  source            MenuImportSource
  status            MenuImportJobStatus @default(queued)

  /// Deliverect correlation: channel link, location, menu id if API returns one
  deliverectChannelLinkId String?
  deliverectLocationId    String?
  deliverectMenuId        String?       // if API provides stable menu id

  /// Idempotency: webhook event id, or hash of pull params + schedule
  idempotencyKey    String?             @unique

  draftVersionId    String?             @unique
  draftVersion      MenuVersion?        @relation("JobDraftVersion", fields: [draftVersionId], references: [id])

  rawPayloadId      String?             @unique
  rawPayload        MenuImportRawPayload?

  errorCode         String?
  errorMessage      String?

  startedAt         DateTime            @default(now())
  completedAt       DateTime?
  createdBy         String?             // "system" | user id | "webhook"

  vendor            Vendor              @relation(fields: [vendorId], references: [id], onDelete: Cascade)
  issues            MenuImportIssue[]

  @@index([vendorId, status])
  @@index([vendorId, createdAt(sort: Desc)])
}
```

### B.3 `MenuImportRawPayload`

Store verbatim JSON for forensics and re-normalization when mapping rules change.

```prisma
model MenuImportRawPayload {
  id          String   @id @default(cuid())
  jobId       String   @unique
  job         MenuImportJob @relation(fields: [jobId], references: [id], onDelete: Cascade)

  /// Deliverect response headers / api path version (string)
  deliverectApiVersion String?

  payload     Json     // full raw body (or metadata + storage key if moved to blob)
  payloadSha256 String  // dedupe / integrity

  createdAt   DateTime @default(now())
}
```

*Production note:* if payloads exceed Postgres JSON comfort, add `storageKey String?` + S3; keep hash + metadata in DB.

### B.4 `MenuImportIssue`

```prisma
model MenuImportIssue {
  id              String                   @id @default(cuid())
  jobId           String
  job             MenuImportJob            @relation(fields: [jobId], references: [id], onDelete: Cascade)

  severity        MenuImportIssueSeverity
  code            String                   // stable machine code e.g. DUPLICATE_PLU, MISSING_PRICE

  /// JSON Pointer or dot-path into canonical tree e.g. "/categories[0]/items[3]"
  entityPath      String?

  deliverectId    String?                  // product/modifier/category id from payload
  mennyuEntityType String?                 // MenuItem | ModifierGroup | ModifierOption
  mennyuEntityId  String?

  message         String
  details         Json?

  waived          Boolean                  @default(false)
  waivedBy        String?
  waivedAt        DateTime?

  @@index([jobId])
  @@index([jobId, severity])
}
```

### B.5 `MenuVersion`

Canonical **snapshot** for diff + publish + rollback. Phase 1 can be **JSON-only**; later you can add normalized child tables if you need SQL reporting.

```prisma
model MenuVersion {
  id              String            @id @default(cuid())
  vendorId        String

  state           MenuVersionState  @default(draft)

  /// Canonical internal shape (see section C). Same schema for draft and published.
  canonicalSnapshot Json

  /// For quick equality checks without deep JSON compare
  canonicalSnapshotSha256 String

  /// Source job that produced this draft (published versions still keep link for audit)
  sourceJobId     String?
  sourceJob       MenuImportJob?    @relation("JobDraftVersion", fields: [sourceJobId], references: [id])

  previousPublishedVersionId String?
  previousPublishedVersion    MenuVersion?  @relation("VersionHistory", fields: [previousPublishedVersionId], references: [id], onDelete: SetNull)
  nextVersions                MenuVersion[] @relation("VersionHistory")

  publishedAt     DateTime?
  publishedBy     String?

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  vendor          Vendor            @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@index([vendorId, state])
  @@index([vendorId, publishedAt(sort: Desc)])
}
```

*Clarification:* `MenuImportJob.draftVersionId` points to the **draft** `MenuVersion` being worked; on publish, that row transitions `draft` → `published` **or** you clone snapshot to a new published row (cleaner for immutability). **Recommended:** **immutable snapshots** — publish creates a **new** `MenuVersion` row (`published`), mark prior published `archived`, and delete/leave draft as `superseded` / delete draft row. Adjust FKs so `draftVersionId` references the draft copy that may be discarded after publish.

**Simpler immutability pattern:**

- On successful import: create `MenuVersion` `draft` + link job.
- On publish: create **new** `MenuVersion` `published` with **copy** of `canonicalSnapshot`, set old published → `archived`, link `previousPublishedVersionId`, then **delete draft** or mark draft `superseded`.

### B.6 Source metadata on **live** menu entities (extend existing models)

Add to **`MenuItem`**, **`ModifierGroup`**, **`ModifierOption`** (incremental migrations):

```prisma
// On MenuItem (add fields)
menuSource              MennyuMenuEntitySource @default(MENNYU_MANUAL)
deliverectCategoryId    String?   // if Deliverect exposes category/bundle id
deliverectLastSeenAt    DateTime?
lastPublishedVersionId  String?   // FK MenuVersion optional — which publish last touched this row

// On ModifierGroup (add fields)
deliverectModifierGroupId String?
menuSource                MennyuMenuEntitySource @default(MENNYU_MANUAL)
deliverectLastSeenAt      DateTime?

// On ModifierOption (already has deliverectModifierId)
menuSource              MennyuMenuEntitySource @default(DELIVERECT_SYNCED) // or MANUAL for legacy
deliverectLastSeenAt    DateTime?
```

**Rule:** `DELIVERECT_SYNCED` fields are **overwritten on publish** from canonical snapshot unless an override exists.

### B.7 `MenuEntityOverride` (explicit overrides; optional Phase 1.5)

```prisma
model MenuEntityOverride {
  id            String   @id @default(cuid())
  vendorId      String
  entityType    String   // MenuItem | ModifierGroup | ModifierOption
  entityId      String

  /// JSON patch: { "name": "...", "priceCents": 999 } only whitelisted keys
  patch         Json
  reason        String?

  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  createdBy     String?

  vendor        Vendor   @relation(fields: [vendorId], references: [id], onDelete: Cascade)

  @@unique([vendorId, entityType, entityId])
  @@index([vendorId])
}
```

**Publish merge order:** base from canonical Deliverect → apply `MenuEntityOverride` patch → write row + set `menuSource = MENNYU_OVERRIDE` or keep `DELIVERECT_SYNCED` on row with override table driving display (either is fine; **prefer** keeping row `DELIVERECT_SYNCED` + override table for clarity).

---

## C. Canonical types (TypeScript)

**Phase 1A implemented:** canonical Zod + types in `src/domain/menu-import/canonical.schema.ts`, issues in `issues.ts`, validation in `validate.ts`, Deliverect normalization in `src/integrations/deliverect/menu/normalize.ts`, end-to-end `runPhase1aDeliverectMenuImport` in `phase1a-pipeline.ts`. **IDs are strings** — always store Deliverect’s ids as returned (normalize to string).

```typescript
/** Stable codes for validation / issues */
export type CanonicalMoneyCents = number; // integer >= 0

export interface MennyuCanonicalMenu {
  schemaVersion: 1;
  vendorId: string;
  /** When known from Deliverect */
  deliverect: {
    channelLinkId?: string;
    locationId?: string;
    menuId?: string;
    /** API or webhook payload version string for debugging */
    sourcePayloadKind: "deliverect_menu_api_v1" | "deliverect_menu_webhook_v1";
  };
  categories: MennyuCanonicalCategory[];
  /** Modifier groups that can be shared across products (Deliverect often nests; normalize to flat with references) */
  modifierGroupDefinitions: MennyuCanonicalModifierGroup[];
  products: MennyuCanonicalProduct[];
}

export interface MennyuCanonicalCategory {
  /** Deliverect category / section id */
  deliverectId: string;
  name: string;
  sortOrder: number;
  /** Product plu/_ids belonging to this category */
  productDeliverectIds: string[];
}

export interface MennyuCanonicalProduct {
  /** Primary Deliverect product id / PLU */
  deliverectId: string;
  name: string;
  description?: string | null;
  priceCents: CanonicalMoneyCents;
  /** Snooze / visibility — map Deliverect availability flags */
  isAvailable: boolean;
  sortOrder: number;
  imageUrl?: string | null;
  basketMaxQuantity?: number | null;
  /** References into modifierGroupDefinitions by deliverectId */
  modifierGroupDeliverectIds: string[];
}

export interface MennyuCanonicalModifierGroup {
  deliverectId: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  /** Parent option for nested groups (Deliverect bundles) */
  parentDeliverectOptionId?: string | null;
  options: MennyuCanonicalModifierOption[];
}

export interface MennyuCanonicalModifierOption {
  deliverectId: string;
  name: string;
  priceCents: CanonicalMoneyCents;
  sortOrder: number;
  isDefault: boolean;
  isAvailable: boolean;
  /** Nested modifier groups attached to this option */
  nestedGroupDeliverectIds: string[];
}
```

**Normalizer output must:**

- Dedupe `deliverectId` per scope (vendor); emit `MenuImportIssue` on collision.
- Preserve unknown Deliverect fields in a side-car on the **raw** payload only, not in canonical (keep canonical strict).

---

## D. Safest implementation order

### D.1 Foundation (no live menu writes)

1. **Zod schemas** for `MennyuCanonicalMenu` + version constant `schemaVersion`.
2. Prisma: `MenuImportJob`, `MenuImportRawPayload`, `MenuImportIssue`, `MenuVersion` (draft only at first).
3. **Raw ingest service:** save payload + hash; attach to job.

### D.2 Phase 1a — Pull only

4. **Deliverect menu HTTP client** (authenticated) — return `unknown`, store raw, then normalize.
5. **Normalizer** Deliverect response → `MennyuCanonicalMenu` (feature-flag per vendor or env).
6. **Validator** canonical → issues list; persist `MenuImportIssue`; job status → `awaiting_review` or `failed`.

### D.3 Phase 1b — Diff & publish (still behind flag)

7. **Load last published** `MenuVersion` for vendor (`state = published`); if none, diff against empty baseline.
8. **Diff engine** (structural): added/removed/changed entities by `deliverectId`; surface in admin UI.
9. **Publish service** (transaction):
   - Upsert `MenuItem` / `ModifierGroup` / `ModifierOption` / joins by **`deliverect*` ids**.
   - Set `menuSource = DELIVERECT_SYNCED`, `deliverectLastSeenAt = now()`.
   - Create new **published** `MenuVersion` snapshot; archive previous.
10. **Admin UI:** job list, issue list, diff view, “Publish” with confirmation.

### D.4 Phase 2 — Webhooks

11. **Webhook route** (separate from order status webhook if needed): verify HMAC, store **raw event** + `idempotencyKey`, create `MenuImportJob` (`DELIVERECT_MENU_WEBHOOK`) **queued**.
12. **Worker / async step** (or same request with timeout guard): same pipeline as pull — **never** touch live menu until publish.
13. **Auto-publish policy:** start with **never auto-publish**; optional future `Vendor.autoPublishMenuImports` for trusted tenants.

### D.5 Overrides & hardening

14. `MenuEntityOverride` + merge in publish.
15. **Rollback:** admin “Restore version X” → new job that sets `canonicalSnapshot` from archived `MenuVersion` → publish (same pipeline).
16. **POS overwrite:** document that the **next** import overwrites `DELIVERECT_SYNCED` fields; overrides persist unless removed.

---

## Source-of-truth rules (summary)

| Situation | Behavior |
|-----------|----------|
| New Deliverect product id | Insert on publish |
| Removed from Deliverect payload | **Policy choice:** soft-disable (`isAvailable=false`) or archive; recommend **soft-disable** + issue `REMOVED_FROM_UPSTREAM` |
| Manual name change on synced item | Block in UI **or** store override; never silently match by name |
| Webhook + pull race | Same `idempotencyKey` / payload hash dedupes job; last successful publish wins |
| Live DB | Never updated outside `menu-import/publish` for Deliverect-managed vendors (enforce with `Vendor.menuManagementMode` enum if needed) |

---

## Alignment with current Mennyu schema

- You already have **`deliverectProductId`** and **`deliverectModifierId`**. Add **`deliverectModifierGroupId`** on `ModifierGroup` and **`deliverectCategoryId`** on `MenuItem` (or introduce a real **`Category`** model later if you outgrow “category as Deliverect id on item”).
- **`Vendor.deliverectChannelLinkId`** remains the join key for routing orders; menu import should use the same + `deliverectLocationId` as required by Deliverect’s menu API.

This document is the intended **single reference** for Deliverect-first menu import; implement incrementally behind feature flags and admin-only publish.
