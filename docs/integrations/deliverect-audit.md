# Deliverect integration audit

Audit date: integration foundation sprint (pre-Square).

## Where Deliverect IDs are stored

| Entity | Fields | Notes |
|--------|--------|-------|
| `Vendor` | `deliverectChannelLinkId`, `deliverectLocationId`, `deliverectAccountId`, `deliverectAccountEmail`, `pendingDeliverectConnectionKey`, auto-map outcome fields | Connection + channel registration |
| `MenuItem` | `deliverectProductId`, `deliverectPlu`, `deliverectVariantParentPlu`, `deliverectCategoryId` | Source of truth for menu mapping |
| `ModifierGroup` | `deliverectModifierGroupId`, `deliverectIsVariantGroup`, `deliverectMultiMax` | |
| `ModifierOption` | `deliverectModifierId`, `deliverectModifierPlu` | |
| `VendorOrder` | `deliverectOrderId`, `deliverectChannelLinkId`, `lastDeliverectPayload`, `deliverectPayloadValidation` | Outbound audit |
| `MenuImportJob` | Deliverect-specific source enums and raw payload | Menu import pipeline |
| `MenuVersion` | `deliverectMenuId`, channel/location IDs on publish snapshot | Published menu |

**New spine:** `ProviderEntityMapping` is available for Square and gradual Deliverect migration. Deliverect fields remain authoritative.

## Status mapping (Deliverect → Open Order)

- **File:** `src/integrations/deliverect/deliverect-status-map.ts`
- **Entry:** `interpretDeliverectWebhookFlat()`
- Maps numeric Deliverect status codes to `VendorFulfillmentStatus` / `VendorRoutingStatus`
- Applied via webhook handler → vendor order state updates

## Order submission

- **File:** `src/services/deliverect.service.ts` → `submitVendorOrderToDeliverect()`
- **Pipeline:** load → validate → transform → `integrations/deliverect/client.submitOrder`
- **Trigger:** Post-payment routing (`post-payment.service.ts`), manual retry, admin tools
- **Wrapper:** `src/lib/integrations/adapters/deliverect.adapter.ts` → `deliverectOrderAdapter.submitOrder()`

## Menu / mapping validation

- **Preflight:** `src/integrations/deliverect/validate.ts`
- **Integrity report:** `src/services/deliverect-menu-integrity.service.ts`
- **Readiness map:** `src/services/vendor-deliverect-mapping-readiness.server.ts`
- **Admin mapping UI:** `/admin/vendors/[vendorId]/deliverect-mapping`

## Readiness checks

- **Routing:** `src/lib/vendor-order-routing-mode.ts` → `isVendorRoutingOperationalReady()`
- **Pod/vendor setup:** `src/lib/vendor-pod-readiness.ts`, `src/lib/vendor-readiness-states.ts`
- **Normalized (new):** `src/lib/integrations/provider-readiness.service.ts`

## Deliverect-specific UI

| Surface | Path / component |
|---------|------------------|
| Admin mapping | `/admin/vendors/[vendorId]/deliverect-mapping` |
| Admin channel registrations | `/admin/deliverect-channel-registrations` |
| Admin webhook incidents | `/admin/deliverect-webhook-incidents` |
| Vendor menu sync | `/vendor/[vendorId]/menu` |
| Vendor kitchen | `/vendor/[vendorId]/kitchen` |
| Menu import jobs | `/admin/menu-imports` |

## Wrapper status

| Method | Status |
|--------|--------|
| `validateConnection` | Wrapped — delegates to existing POS + mapping checks |
| `validateMappings` | Wrapped — uses menu integrity service |
| `submitOrder` | Wrapped — calls `submitVendorOrderToDeliverect` unchanged |
| `mapStatusWebhook` | Wrapped — calls `interpretDeliverectWebhookFlat` |
| `importMenu` | **TODO** — use existing deliverect-pull API; not wrapped yet |

## Migration plan (Deliverect connections)

1. Deploy `VendorIntegrationConnection` schema (no auto backfill in migration SQL).
2. Run `prepareDeliverectConnectionFromVendor(vendorId)` per Deliverect vendor when ops ready.
3. Optionally dual-write `ProviderEntityMapping` on menu publish (future sprint).
4. Do not remove Deliverect columns until mapping table is validated in production.
