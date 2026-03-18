# Cross-Surface Consistency Audit

**Date:** 2025-03 (post Stripe, routing abstraction, operating modes, retry/manual recovery, admin attention).  
**Scope:** Order state, routing, fulfillment, refunds, recovery across customer, vendor, admin, and core services.

---

## 1. Inconsistencies Found (by severity)

### High (fixed)

- **Parent status derivation differed after payment vs after VO updates.**  
  Post-payment and API order confirmation used `deriveParentRoutingStatusFromAttempts` (routing-only, raw VO state). Order-status.service and customer view use `getEffectiveChildStateForParentDerivation` + `deriveParentStatusFromChildren` (recovery-normalized).  
  **Risk:** If a VO was ever recovered before payment was recorded, or for future flows, parent status could be "failed" on one path and "in_progress" on another.  
  **Fix:** Post-payment and API orders now use `deriveParentStatusFromVendorOrders` (same effective-child derivation and full parent status) and persist that. All writers now share one derivation path.

### Medium (no change; documented)

- **Customer refund message only when order is cancelled.**  
  Refund message is shown only when `derivedStatus === "cancelled"`. Partial refunds (e.g. one vendor order cancelled) may not show a refund line on the main status card. Timeline still includes refund entries. Acceptable for current scope; extend later if partial-refund messaging is required.

- **Admin order detail shows raw `Order.status`.**  
  Admin reads persisted `order.status`. That status is updated by the same derivation (post-payment, `recomputeAndPersistParentStatus` after every VO change), so it stays in sync. If a bug ever skipped `recomputeAndPersistParentStatus`, admin could be stale; no separate “derived” display.

### Low (no change)

- **`getVendorOrderSourceLabel` unused.**  
  Vendor dashboard now uses operating-mode helpers only. `vendor-order-source.ts` is unused but kept for possible reuse (e.g. non-dashboard labels).

- **`deriveParentRoutingStatusFromAttempts` unused.**  
  Left in `domain/order-state.ts` for possible routing-only callers; no current callers.

---

## 2. Exact Files Changed

| File | Change |
|------|--------|
| **`src/services/order-status.service.ts`** | Added `deriveParentStatusFromVendorOrders(vendorOrders)` using `getEffectiveChildStateForParentDerivation` + `deriveParentStatusFromChildren`. Single shared derivation for persisting parent status. |
| **`src/services/post-payment.service.ts`** | Replaced `deriveParentRoutingStatusFromAttempts` with `deriveParentStatusFromVendorOrders`. Post-payment fetch now includes `fulfillmentStatus` and `statusHistory` for each VO. Persists full parent status (e.g. `routing`, `routed`, `routed_partial`, `failed`) from shared derivation. |
| **`src/app/api/orders/route.ts`** | Same as post-payment: use `deriveParentStatusFromVendorOrders`, fetch VO `statusHistory`, persist derived parent status. |
| **`docs/CROSS-SURFACE-CONSISTENCY-AUDIT.md`** | This audit and fix log. |

---

## 3. Explanation of Each Fix

**Unified parent status derivation**

- **Why:** Customer view and `recomputeAndPersistParentStatus` treat recovered VOs as “confirmed” for derivation. Post-payment and API orders were using raw routing statuses and a routing-only helper, so they could write "failed" or "routed_partial" where the rest of the app would show "in_progress" after recovery.
- **What:** Introduced `deriveParentStatusFromVendorOrders` in order-status.service (same logic as `recomputeAndPersistParentStatus`: effective child state then `deriveParentStatusFromChildren`). Post-payment and API orders now load VOs with `statusHistory`, call this helper, and call `setOrderStatus` with the result.
- **Result:** One derivation path for all writes. Recovery-normalized behavior is consistent after payment, after VO updates, and for customer/admin/vendor views.

---

## 4. Verification Summary (no code changes)

- **Status consistency:** Customer uses `getOrderWithUnifiedStatus` (effective child state + derivation). Admin and vendor see persisted status and VO state; persistence is now driven by the same derivation.
- **Routing vs fulfillment:** All surfaces treat `sent` and `confirmed` as successful routing; manual path sets `confirmed`; no UI assumes only Deliverect can confirm.
- **Recovery normalization:** Manual recovery calls `applyVendorOrderTransition` → `recomputeAndPersistParentStatus`. Needs Attention excludes VOs with `fulfillmentStatus !== "pending"`. Customer uses `isVendorOrderManuallyRecovered` for per-VO labels and effective state for derivation.
- **Refund consistency:** RefundAttempts loaded in `getOrderWithUnifiedStatus`; customer sees latest attempt when order is cancelled; admin timeline shows refunds; no conflicting “refund needed” when already completed.
- **Vendor operating mode:** Dashboard uses `getVendorOrderOperatingMode`, `getOperatingModeBadgeLabel`, `getOperatingModeActionHint`, `isMennyuControlsPrimary` only; no duplicate source logic.
- **UI actions:** Vendor card shows/de-emphasizes buttons by mode; admin exception and progression actions use `getAdminActionState` and `getExceptionType`; recovery does not hide required actions.
- **Data flow:** Single order-status service for transitions and parent recompute; single derivation helper for all status writes; no duplicated derivation formulas.

---

## 5. Remaining Edge Cases / Risks

- **Partial refunds:** Customer sees refund message only when order is fully cancelled; partial refunds are not surfaced on the main status card (timeline may still show them).
- **Admin status staleness:** If any code path updates a VO without calling `recomputeAndPersistParentStatus`, admin (and any consumer of raw `Order.status`) could be stale until the next VO update that does call it.
- **Client-side `isDeliverectLive`:** Vendor dashboard gets `isDeliverectLive` from server props; after client-side refresh or SPA nav it may be false until the next server render.

---

## 6. Recommended Next Step

- **Periodic reconciliation (optional):** A small job or admin action that, for orders in non-terminal status, reloads VOs with statusHistory, runs `deriveParentStatusFromVendorOrders`, and updates `Order.status` if it differs. Would correct any rare missed `recomputeAndPersistParentStatus` and keep admin/customer in sync.
