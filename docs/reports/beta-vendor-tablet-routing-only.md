# Beta: vendor order routing is tablet-only

**Date:** 2026-08-08  
**Status:** Implemented

## Goal

For beta launch, vendors must not see or configure Deliverect / Square as order-routing options. Tablet / Open Order dashboard (`manual_dashboard`) is the only vendor-facing routing method. Integration infrastructure and admin tooling remain intact.

## How vendor routing availability is centralized

New module: `src/lib/vendor-routing-availability.ts`

| API | Beta behavior |
|-----|----------------|
| `VENDOR_POS_ROUTING_SELECTION_ENABLED` | `false` |
| `getVendorAvailableRoutingModes()` | `["manual_dashboard"]` |
| `getAdminAvailableRoutingModes()` | `manual_dashboard`, `deliverect`, `square` |
| `assertVendorPosRoutingConfigurationAllowed()` | Rejects vendor POS connect/config mutations |
| `vendorMayConfigurePosOrderRouting()` | UI gate for vendor surfaces |

Re-enablement: set `VENDOR_POS_ROUTING_SELECTION_ENABLED = true` (no large reconstruction required).

## Vendor-facing screens changed

| Surface | Change |
|---------|--------|
| Account vendor onboarding (`VendorSetupForm`) | Removed “Menu system” / POS selector; copy says orders appear in Open Order dashboard |
| Vendor create (`createVendorProfile`) | Explicitly sets `orderRoutingMode: manual_dashboard`, `menuSource: open_order` |
| Setup / Integrations hub | No available Deliverect/Square/Toast cards; “Order management” + Menu framing |
| `connect-pos` | Always blocked under beta policy (tablet message + Kitchen CTA) |
| `integrations/square` | Blocked under beta policy (Kitchen + Menu Builder CTAs) |
| Setup checklist (vendor audience) | Presented as tablet/Menu Builder; no Connect POS / Connect Square |

## Server actions / APIs changed

Vendor-authorized mutations now call `assertVendorPosRoutingConfigurationAllowed()`:

- `startDeliverectPosOnboarding`, `saveVendorPosConnection`
- `retryVendorDeliverectConnection`
- `selectSquareLocationAction`, `disconnectSquareAction`
- `GET /api/vendor/[vendorId]/square/oauth/start` → **403** when beta policy is on

There was already **no** vendor API to set `orderRoutingMode` to `deliverect` / `square`. Admin-only `adminUpdateVendorOrderRoutingMode` still supports all modes.

## Onboarding default

Yes — new vendors are created with:

- `orderRoutingMode = manual_dashboard`
- `menuSource = open_order`

(schema defaults reinforced by explicit create fields).

## Legacy integrated vendors

If `orderRoutingMode` is still `deliverect` or `square`:

- Vendor cannot connect/reconfigure POS routing
- Setup/integrations CTAs point to Kitchen / dashboard, not Connect POS/Square
- Provider connection rows and historical data are **not** deleted
- Order-injection backends and admin diagnostics remain
- Admins should migrate them to tablet via existing routing reconcile before launch

## Admin Deliverect / Square visibility

**Preserved.**

- Admin vendor routing radios use `getAdminAvailableRoutingModes()` (all three modes)
- Admin vendor search routing filter unchanged (Tablet / Deliverect / Square)
- Admin diagnostics / Square injection tools unchanged

## Integration code not removed

Deliberately retained: Deliverect/Square APIs, OAuth, mappings, webhooks, import/publish pipelines, PEM, admin repair scripts, schema fields.

## Compatibility with active menu source

Tablet beta vendors use `open_order` menu source + Menu Builder. Routing reconcile from the menu-source ownership work remains the admin path to demote historical provider menus — this change does not revive them.

## Tests

- `vendor-routing-availability.test.ts` — vendor allowlist vs admin allowlist + mutation gate
- `vendor-setup-integrations.test.ts` — beta UI + re-enable path
- `vendor-pod-readiness.test.ts` — checklist no longer offers Square connect for vendors
- `provider-ux-regression.test.ts` — updated for tablet-only cards

## Verification checklist

1. New vendor → `manual_dashboard`, no POS routing selection  
2. Existing tablet vendor → no Deliverect/Square options  
3. Legacy Deliverect/Square → cannot re-enable via UI/API; data retained  
4. Vendor OAuth/connect actions rejected  
5. Admin can still set/filter Deliverect and Square  
