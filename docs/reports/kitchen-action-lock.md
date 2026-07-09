# Kitchen Action Lock for Active Integrations

**Date:** 2026-07-09  
**Scope:** Vendor kitchen/dashboard status buttons and server enforcement for externally routed orders (Square, Deliverect, future POS). Checkout, payouts, Square injection, Square webhook sync, Deliverect routing, and manual routing are unchanged.

---

## Summary

Vendors with an **active external routing integration** now see kitchen status actions locked or de-emphasized. The external provider is the operational source of truth for fulfillment status. Orders remain fully visible in Open Order; status still updates from provider webhooks/sync where configured. Failed routing and admin recovery paths remain usable.

---

## Files changed

| Area | Files |
|------|--------|
| Policy | `src/lib/order-routing/kitchen-action-policy.ts` (new), `src/lib/order-routing/kitchen-action-policy.test.ts` (new) |
| Provider copy | `src/lib/integrations/provider-display.ts` |
| Authority bridge | `src/lib/deliverect-vendor-order-authority.ts`, `src/domain/status-authority.ts` |
| Server enforcement | `src/services/order-status.service.ts`, `src/app/api/vendor/orders/[vendorOrderId]/status/route.ts`, `src/app/api/vendor/[vendorId]/orders/route.ts` |
| Vendor UI | `VendorKitchenOrderCard.tsx`, `VendorKitchenBoard.tsx`, `VendorOrderCard.tsx`, `VendorDashboardLiveOrders.tsx`, `VendorDashboardActiveOrdersSection.tsx`, kitchen/dashboard pages |
| Data | `src/lib/vendor-orders-board-data.ts`, `src/lib/vendor-dashboard-data.server.ts` |
| Admin UI | `AdminVendorOrderOperationalPanel.tsx` |
| Tests | `deliverect-vendor-order-authority.test.ts`, `vendor-operational-api-auth.test.ts`, `VendorOrderCard.deliverect-authority.test.ts` |

---

## Kitchen action policy rules

`getKitchenActionPolicy(vendor, order, integration?)` returns:

- `actionsLocked`, `provider`, `providerDisplayName`, `reason`, `managedOrderBadge`, `kitchenLockTooltip`, `statusSyncAvailable`, `statusSyncCopy`, `recoveryAllowed`, `recoveryCopy`, `showProviderManagedState`, `routingFailed`

### Manual / tablet (`orderRoutingMode = manual_dashboard`)

- `actionsLocked = false`
- Badge: **Managed in Open Order**
- No external lock messaging

### Square (`orderRoutingMode = square`)

**Locked when:**

- Not manually recovered and not `admin_override`
- Routing did not fail without external handoff
- `squareOrderId` present **or** `routingStatus` is `sent` / `confirmed`

**Not locked when:**

- `routingStatus = failed` and no `squareOrderId` → recovery copy: *Routing failed. Open Order still has the paid order.*
- `manuallyRecoveredAt` set → admin/vendor recovery in OO

**Status sync:** `statusSyncAvailable` from server-passed `squareStatusSyncConfigured` (webhook env configured).

### Deliverect (`orderRoutingMode = deliverect`)

**Locked when:**

- Channel link present
- Same recovery/admin exceptions as Square
- `deliverectOrderId` present **or** `routingStatus` is `sent` / `confirmed`

**Status sync:** `deliverectRoutingLive` (global routing retry availability).

### Future providers (e.g. Toast)

- Extend `provider-display.ts` registry (`getKitchenManagedOrderBadge`, `getKitchenVendorLockMessage`, etc.) and policy branches using the same pattern.

---

## Buttons / actions locked

For locked orders, vendor-facing UI hides primary status transitions and disables skip-ahead / deny where `canVendorRejectVendorOrder` already respects authority:

- Accept / Confirm
- Preparing
- Ready
- Complete / Picked up
- Deny / Cancel (when vendor-controlled)

**Still available:**

- Degraded Deliverect manual confirm (`routingDegraded` + `pending/pending` → Confirm manually)
- Admin recovery transitions (`admin_action` source)
- Order visibility, pickup codes, line items, external status display

---

## Provider-specific copy

| Provider | Badge | Lock tooltip (example) |
|----------|-------|-------------------------|
| Manual | Managed in Open Order | — |
| Square | Managed in Square | Manage this order in Square. Updates from Square will sync back to Open Order. |
| Square (no webhook) | Managed in Square | …Webhook sync is not configured, so Open Order may not update automatically. |
| Deliverect | Managed in Deliverect | Manage this order through Deliverect/POS. … |
| Routing failed | — | Routing failed. Open Order still has the paid order. |

Copy is provider-specific: Square messaging never appears for Deliverect vendors and vice versa.

---

## Server-side enforcement

1. **`POST /api/vendor/orders/[vendorOrderId]/status`** — `canVendorDashboardMutateVendorOrder()` + provider-aware `vendorDashboardMutateBlockedMessage()`; returns **409** with clear error before transition.
2. **`applyVendorOrderTransition`** — `canVendorDashboardMutateFromPolicy()` for `vendor_dashboard` source on non-manual vendors; blocks stale tabs / direct API calls.
3. **`shouldApplyStatusUpdate`** — allows `square_webhook` on `pos` authority (Square status sync unchanged).

Admin routes (`admin_action`, manual recovery, retry routing, sync from Square) are not gated by vendor kitchen lock.

---

## Recovery exceptions

| Condition | Behavior |
|-----------|----------|
| `routingStatus = failed` without `squareOrderId` / `deliverectOrderId` | No “Managed in …” badge; recovery banner; actions unlocked for manual recovery |
| `manuallyRecoveredAt` / `admin_override` | Actions unlocked in OO |
| Deliverect degraded pending | Manual confirm still allowed via existing degraded path |

---

## Admin behavior

`AdminVendorOrderOperationalPanel` shows:

- Provider-managed badge when locked
- Lock reason / status sync state
- Routing failure banner when applicable

Admin retry routing, sync status from Square, manual recovery, and issue tools remain available.

---

## Tests / QA results

| # | Scenario | Result |
|---|----------|--------|
| 1 | Manual vendor — actions enabled | ✅ `kitchen-action-policy.test.ts` |
| 2 | Square + `squareOrderId` — locked | ✅ |
| 3 | Square sent without id — locked | ✅ |
| 4 | Square routing failed — recovery copy | ✅ |
| 5 | Deliverect routed — locked | ✅ |
| 6 | Deliverect routing failed — recovery copy | ✅ |
| 7 | Server rejects locked Square update | ✅ `vendor-operational-api-auth.test.ts` |
| 8 | Server rejects locked Deliverect update | ✅ |
| 9 | Admin recovery / `admin_override` unlocks | ✅ policy tests |
| 10 | Provider-specific copy | ✅ |
| 11–12 | No cross-provider copy | ✅ |
| 13 | Manual — no external lock warning | ✅ |
| 14 | `square_webhook` allowed on POS authority | ✅ `status-authority` in policy tests |
| 15 | Build passes | ✅ `npm run build` |

---

## Known limitations

1. **Client default for webhook sync flag:** `squareStatusSyncConfigured` defaults to `false` on the client unless passed from server pages; server enforcement uses live env check.
2. **Square sent/confirmed without `squareOrderId`:** Locked by policy when routing succeeded in OO state machine; aligns with provider-as-source-of-truth product rule.
3. **Deliverect without channel link:** Not locked (routing not operational).
4. **Vendor orders ledger detail panel** still uses legacy Square/Deliverect notices in places; kitchen/dashboard cards use unified policy.

---

## Acceptance criteria

| Criterion | Met |
|-----------|-----|
| Manual/tablet vendors manage orders in OO as before | ✅ |
| Square-managed orders visible; vendor status buttons locked | ✅ |
| Deliverect-managed orders visible; vendor status buttons locked | ✅ |
| Provider-specific copy correct | ✅ |
| Failed routing orders recoverable | ✅ |
| Server actions cannot bypass lock | ✅ |
| Admin recovery remains possible | ✅ |
| Checkout, payouts, injection, webhooks, Deliverect, manual routing unchanged | ✅ |
