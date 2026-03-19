# Status authority model — design and migration plan

This document proposes the Prisma schema, TypeScript types, precedence rules, and migration order for the vendor-order status-authority model. Parent order status remains **derived** from vendor order states; this design only adds authority/source tracking and precedence at the vendor-order level.

---

## A. Prisma schema changes

### New enums

Add after existing enums (e.g. after `VendorFulfillmentStatus`):

```prisma
/// Who is the preferred source of truth for this vendor order's status.
enum VendorOrderStatusAuthority {
  pos           // POS/Deliverect is primary; webhook-driven updates preferred
  dma           // Delivery Manager App / Deliverect UI is primary
  vendor_manual  // Vendor dashboard manual actions (no POS sync)
  admin_override // Admin explicitly switched to override/fallback
}

/// Last actor that produced a status change (for audit and precedence).
enum VendorOrderStatusSource {
  deliverect_webhook  // Deliverect order status webhook
  dma_action          // Status change from DMA (future: if we ingest DMA events)
  vendor_dashboard    // Vendor clicked Accept / Preparing / Ready / etc.
  admin_action        // Admin override or fallback switch
  system              // Initial state, routing submit, manual recovery, etc.
}
```

### VendorOrder model — new fields

Add to `VendorOrder` (all **optional** for backward compatibility and safe migration):

```prisma
  // ---- Status authority (nullable until backfilled) ----
  statusAuthority     VendorOrderStatusAuthority?  // Preferred source of truth
  lastStatusSource    VendorOrderStatusSource?     // Last actor that updated status
  lastExternalStatus  String?                     // Raw upstream status (e.g. Deliverect code "70")
  lastExternalStatusAt DateTime?                  // When we last received external status
```

Keep existing: `routingStatus`, `fulfillmentStatus`, `manuallyRecoveredAt`, `manualRecoveryNotes`, `lastWebhookPayload`, etc. No renames.

### VendorOrderStatusHistory — new fields

Add to `VendorOrderStatusHistory` (optional):

```prisma
  authority     VendorOrderStatusAuthority?  // Authority at time of this change
  statusSource  VendorOrderStatusSource?     // What produced this change
  externalStatus String?                     // Raw upstream status if applicable
```

Existing `source` (String) can remain for backward compatibility; new code should set both `source` (e.g. `"deliverect"`) and `statusSource` (e.g. `deliverect_webhook`).

### Index (optional)

```prisma
  @@index([statusAuthority])   // on VendorOrder, for filtering POS vs manual
```

---

## B. TypeScript enums and types

### Domain enums (mirror Prisma)

**File:** `src/domain/status-authority.ts` (new)

```ts
export type VendorOrderStatusAuthority =
  | "pos"
  | "dma"
  | "vendor_manual"
  | "admin_override";

export type VendorOrderStatusSource =
  | "deliverect_webhook"
  | "dma_action"
  | "vendor_dashboard"
  | "admin_action"
  | "system";

export const VENDOR_ORDER_STATUS_AUTHORITIES: VendorOrderStatusAuthority[] = [
  "pos",
  "dma",
  "vendor_manual",
  "admin_override",
];

export const VENDOR_ORDER_STATUS_SOURCES: VendorOrderStatusSource[] = [
  "deliverect_webhook",
  "dma_action",
  "vendor_dashboard",
  "admin_action",
  "system",
];
```

### Extended vendor order type

Where code needs to read authority/source (admin, vendor dashboard, webhook handler):

```ts
export interface VendorOrderWithAuthority {
  id: string;
  routingStatus: string;
  fulfillmentStatus: string;
  statusAuthority?: VendorOrderStatusAuthority | null;
  lastStatusSource?: VendorOrderStatusSource | null;
  lastExternalStatus?: string | null;
  lastExternalStatusAt?: Date | string | null;
  // ... other existing fields
}
```

Use Prisma’s generated type plus these optional fields; no need to duplicate the full VendorOrder shape.

---

## C. Precedence rules (concrete pseudocode)

### Default authority at creation

- When creating a **VendorOrder** in `order.service.ts` (inside `createOrderFromCart`), do **not** set `statusAuthority` yet (leave null).  
- When **routing** runs (e.g. `routing.service.ts` → `submitVendorOrder`):
  - If provider is **deliverect** and submit is attempted (or succeeds): set `statusAuthority = "pos"`, `lastStatusSource = "system"`.
  - If provider is **manual** (no Deliverect): set `statusAuthority = "vendor_manual"`, `lastStatusSource = "system"`.

So default authority is assigned at **first routing action**, not at order creation.

### Applying an incoming status update

Inputs:

- `vo`: current VendorOrder (with optional `statusAuthority`, `lastStatusSource`)
- `incoming`: `{ routingStatus?, fulfillmentStatus?, source: VendorOrderStatusSource, externalStatus?: string }`
- `now`: timestamp

Pseudocode:

```
function shouldApplyStatusUpdate(vo, incoming):
  authority = vo.statusAuthority ?? inferLegacyAuthority(vo)   // see below
  source    = incoming.source

  // 1. Admin override always allowed
  if source === "admin_action" then return ALLOW

  // 2. POS-managed: prefer webhook; block or warn on manual/DMA unless fallback
  if authority === "pos" then
    if source === "deliverect_webhook" then return ALLOW
    if source === "vendor_dashboard" or source === "dma_action" then
      return BLOCK   // or ALLOW_WITH_WARNING if you add "allow_vendor_fallback" later
    return ALLOW     // system (e.g. manual recovery) — already trusted in current design

  // 3. DMA or vendor_manual: allow dashboard and DMA; webhook can still update if POS later syncs
  if authority === "dma" or authority === "vendor_manual" then
    if source === "deliverect_webhook" then return ALLOW   // POS can take over
    if source === "vendor_dashboard" or source === "dma_action" then return ALLOW
    return ALLOW

  // 4. admin_override: allow everything
  if authority === "admin_override" then return ALLOW

  return ALLOW   // default permissive for backward compat
```

- **ALLOW**: apply the update, set `lastStatusSource = source`, `lastExternalStatus` / `lastExternalStatusAt` when `externalStatus` is provided, write history row with `authority` and `statusSource`.
- **BLOCK**: do not apply; return a result like `{ applied: false, reason: "POS_MANAGED_USE_FALLBACK" }` so UI can show “Use fallback to change status”.

### Inferring authority for legacy rows (no authority set)

```
function inferLegacyAuthority(vo):
  if vo.manuallyRecoveredAt != null then return "admin_override"
  if vo.deliverectChannelLinkId != null or (vo.vendor.deliverectChannelLinkId != null) then
    if vo.routingStatus === "sent" or vo.routingStatus === "confirmed" then return "pos"
    if vo.routingStatus === "failed" then return "pos"   // still POS path, just failed
    return "pos"   // had Deliverect config
  return "vendor_manual"
```

Use this only when `vo.statusAuthority == null` so existing orders behave consistently.

### Fallback escalation (stalled POS-managed orders)

- Define “stalled”: e.g. `statusAuthority === "pos"` and `routingStatus === "sent"` and no `lastExternalStatusAt` in the last N minutes (e.g. 15–30), or `routingStatus === "failed"`.
- **Escalation** = admin (or future automated rule) sets `statusAuthority = "admin_override"` and optionally `lastStatusSource = "admin_action"`, with a history/audit row and a note (e.g. “Fallback: POS updates delayed”).
- After that, `shouldApplyStatusUpdate` allows `vendor_dashboard` and `dma_action` for that VO.

No automatic change of authority; only explicit admin (or future “offer fallback” button) sets `admin_override`.

---

## D. Migration plan (safest order)

1. **Add Prisma enums and columns (nullable)**
   - Add `VendorOrderStatusAuthority` and `VendorOrderStatusSource` enums.
   - Add to `VendorOrder`: `statusAuthority`, `lastStatusSource`, `lastExternalStatus`, `lastExternalStatusAt` (all optional).
   - Add to `VendorOrderStatusHistory`: `authority`, `statusSource`, `externalStatus` (all optional).
   - Run `prisma migrate dev` with a name like `add_vendor_order_status_authority`.
   - Deploy; existing code paths ignore new fields (no behavior change).

2. **Add TypeScript types and helpers**
   - Create `src/domain/status-authority.ts` with enums and `inferLegacyAuthority`, `shouldApplyStatusUpdate` (stub or full).
   - No call sites yet; tests only.

3. **Set default authority when routing**
   - In `routing.service.ts` (and any path that creates or first routes a VO):
     - After successful **Deliverect** submit: `statusAuthority = "vendor_manual"` (if null) and `lastStatusSource = "system"`. **Do not** set `pos` until a Deliverect webhook is processed (`applyDeliverectStatusWebhook` then promotes to `pos` when safe).
     - After **manual** path (no Deliverect): `statusAuthority = "vendor_manual"`, `lastStatusSource = "system"`.
   - **Legacy infer:** if `statusAuthority` is null and vendor has a channel link but `routingStatus === "sent"`, infer `vendor_manual` (submit not yet proven by webhook).
   - When applying Deliverect webhook updates: set `lastStatusSource = "deliverect_webhook"`, promote `statusAuthority` to `pos` when current is null/`vendor_manual` (never overwrite `admin_override` / `dma`), plus `lastExternalStatus` / `lastExternalStatusAt` and history metadata.

4. **Precedence in status update paths**
   - In `order-status.service.ts` (or wherever vendor-order status is updated):
     - Before applying an update from vendor dashboard or DMA, call `shouldApplyStatusUpdate(vo, { source: "vendor_dashboard" })` (or `dma_action`).
     - If BLOCK, return a structured result to the API so the UI can show “This order is POS-managed; use fallback to change status” and optionally offer “Switch to fallback”.
   - Deliverect webhook path: always allow when source is `deliverect_webhook` for POS-managed VOs; set authority/source and external status fields.

5. **Admin fallback action**
   - New admin action (e.g. “Use fallback / Override status source”) that sets `statusAuthority = "admin_override"` and writes a VendorOrderStatusHistory row with `statusSource = "admin_action"` and a note. No change to `routingStatus`/`fulfillmentStatus` unless admin also sets a new status in the same action.

6. **Backfill (optional)**
   - One-time script or migration: for all VendorOrder rows where `statusAuthority` is null, set `statusAuthority = inferLegacyAuthority(vo)` (and optionally `lastStatusSource = "system"`). Run during low traffic.

7. **UI**
   - Vendor dashboard: when an action is blocked, show message and optional “Request fallback” (or direct link to admin).
   - Admin: show `statusAuthority` and `lastStatusSource` on vendor order detail; show “Switch to fallback” for POS-managed stuck orders.

---

## Summary

| Item | Location |
|------|----------|
| Prisma enums | `VendorOrderStatusAuthority`, `VendorOrderStatusSource` |
| VendorOrder new fields | `statusAuthority`, `lastStatusSource`, `lastExternalStatus`, `lastExternalStatusAt` (all optional) |
| VendorOrderStatusHistory new fields | `authority`, `statusSource`, `externalStatus` (optional) |
| TS types | `src/domain/status-authority.ts` |
| Default authority | Deliverect submit → `vendor_manual` until first webhook; then `pos`. Manual route → `vendor_manual`. |
| Precedence | `shouldApplyStatusUpdate()`; BLOCK vendor_dashboard/dma when authority is pos unless admin_override |
| Fallback | Admin sets `statusAuthority = "admin_override"` with audit |
| Parent order | Unchanged; still derived from vendor order states only |

This keeps the routing abstraction (single entry point in `routing.service.ts`), preserves manual fallback, and stays backward-compatible by making all new fields nullable and inferring authority for legacy rows.

---

## Where to wire (file-level)

| Step | File | Change |
|------|------|--------|
| Default authority at first routing | `src/services/routing.service.ts` | After Deliverect submit success: `statusAuthority: "vendor_manual"` if null. After manual path: `statusAuthority: "vendor_manual"` if null. |
| Webhook sets source + external + POS promotion | `src/services/order-status.service.ts` | In `applyDeliverectStatusWebhook`: promote `statusAuthority` to `pos` when eligible; set `lastStatusSource`, external audit, `deliverectWebhookLastApply`, history. |
| Precedence check before vendor action | `src/services/order-status.service.ts` | In `applyVendorOrderTransition`: if VO has `statusAuthority === "pos"` and source is `vendor_dashboard`, call `shouldApplyStatusUpdate`; if BLOCK, return error code for UI. |
| Admin fallback | New action or admin API | Update VO `statusAuthority = "admin_override"`, append history with `statusSource: "admin_action"` and note. |
| Infer legacy | `src/domain/status-authority.ts` | `inferLegacyAuthority(vo)` used wherever we read authority and VO might have null. |
