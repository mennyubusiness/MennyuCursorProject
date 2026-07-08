# Admin Square Order Injection Diagnostics

**Date:** 2026-07-08

## Summary

The admin vendor detail page did not reflect Square order injection readiness correctly because readiness logic treated `squareOrderRoutingEnabled` as a prerequisite for the **Enable** action — a circular dependency that made injection impossible to turn on from the UI even when connection, location, menu, and mappings were healthy.

This change splits **prerequisites** (can enable) from **injection operational** (will actually call Square APIs), adds a full diagnostics panel, fixes the enable action, and exposes a JSON debug route.

---

## Root cause

`loadSquareOrderRoutingReadiness()` included `squareOrderRoutingEnabled` in both `missingRequirements` and the `ready` boolean. The admin **Enable Square order routing** button was `disabled={!squareOrderRoutingReady.ready}`, and the server action `adminSetSquareOrderRoutingEnabled()` called `assertSquareOrderRoutingReady()` — which required `enabled === true` before allowing enable.

**Result:** prerequisites could pass, but admins could never enable injection.

`SQUARE_ROUTING_LIVE=true` alone never enables vendor routing; it only allows live Square API calls when a vendor is already configured for Square injection.

---

## Env var reads (Part 1)

| Variable | Read in | Purpose |
|----------|---------|---------|
| `ENABLE_SQUARE_INTEGRATION` | `src/lib/env.ts` → `src/lib/integrations/square/square-config.ts` (`getSquareConfigSnapshot`) | Controls Square OAuth/connect UI availability in production |
| `SQUARE_ROUTING_LIVE` | `src/lib/env.ts` → `square-order-routing-readiness.ts`, `square-order.service.ts`, `routing-availability.ts` | Global kill switch for live Square CreateOrder/CreatePayment API calls |
| `SQUARE_ENVIRONMENT` / `SQUARE_MODE` | `src/lib/env.ts` → `square-config.ts` | Sandbox vs production Square hosts |
| `SQUARE_APPLICATION_ID` | `src/lib/env.ts` → `square-config.ts` | OAuth client id (snapshot exposes id only in server diagnostics — not rendered in new admin panel) |
| `SQUARE_APPLICATION_SECRET` | `src/lib/env.ts` → `square-config.ts`, `assertSquareOAuthConfigured()` | OAuth secret — **never exposed in UI or debug JSON** |
| `SQUARE_OAUTH_REDIRECT_URL` | `src/lib/env.ts` → `square-config.ts` | OAuth redirect — safe URL only in config snapshot |

**Redeploy required:** All values are read server-side via `env` at process start. Changing them in Vercel requires **redeploy/restart** before the admin diagnostics panel or routing behavior reflects new values.

**`SQUARE_ROUTING_LIVE` does not change vendor `orderRoutingMode` or auto-enable `squareOrderRoutingEnabled`.** Manual and Deliverect vendors are unaffected.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/integrations/square/square-order-routing-readiness.ts` | Split `prerequisitesReady` vs `injectionOperationalReady`; mapping counts; `assertSquareOrderRoutingPrerequisites()` |
| `src/lib/integrations/square/admin-square-order-injection-diagnostics.server.ts` | **New** — centralized admin diagnostics loader |
| `src/app/admin/(dashboard)/vendors/[vendorId]/AdminSquareOrderInjectionDiagnosticsPanel.tsx` | **New** — diagnostics UI panel |
| `src/app/admin/(dashboard)/vendors/[vendorId]/square-routing-debug/route.ts` | **New** — admin JSON debug at `/admin/vendors/[vendorId]/square-routing-debug` |
| `src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorOrderRoutingSection.tsx` | Enable uses prerequisites; injection block when saved mode is Square; updated copy |
| `src/app/admin/(dashboard)/vendors/[vendorId]/AdminVendorRescueClient.tsx` | Renders diagnostics panel |
| `src/app/admin/(dashboard)/vendors/[vendorId]/page.tsx` | `dynamic = "force-dynamic"`; loads diagnostics |
| `src/services/admin-vendor-rescue.service.ts` | Enable gate uses `assertSquareOrderRoutingPrerequisites` |
| Tests | `square-order-routing-readiness.test.ts`, `admin-square-order-injection-diagnostics.test.ts`, `square-routing-debug/route.test.ts`, `admin-vendor-order-routing.test.ts` |

**Unchanged:** checkout, payouts, Deliverect/manual routing, admin safety gate (`squareOrderRoutingEnabled` still admin-only).

---

## Admin UI (Parts 2–4)

### Diagnostics panel

On admin vendor detail, **Square order injection diagnostics** shows:

**Global/env**
- `ENABLE_SQUARE_INTEGRATION`
- `SQUARE_ROUTING_LIVE`
- `SQUARE_ENVIRONMENT`
- Square OAuth configured (quartet complete)

**Vendor**
- `orderRoutingMode`
- `squareOrderRoutingEnabled`
- Square connection status (`connected` / `error` / `missing`)
- Selected Square location
- Published Square-imported menu
- Active item / modifier mapping counts
- Routing readiness (`ready` / `not ready`)
- Blocking reasons (list)

Link: **Open JSON debug** → `/admin/vendors/[vendorId]/square-routing-debug`

### Enable action (Part 3)

When `orderRoutingMode === "square"` (saved on vendor):

- **Disabled injection:** copy explains orders stay in Open Order only; **Enable Square order injection** enabled when `prerequisitesReady` (not when already enabled).
- **Enabled injection:** explains prepaid pickup injection; Stripe/payouts unchanged.

### Stale page fix (Part 4)

- Admin vendor detail: `export const dynamic = "force-dynamic"`
- Toggle actions: `router.refresh()` + `revalidatePath(/admin/vendors/[vendorId])` (existing + preserved)

---

## Poke Sea / test vendor expected state

After deploy, for a Square-connected vendor with published Square menu (e.g. Poke Sea):

1. Diagnostics panel shows env flags from **this deployment** (verify `SQUARE_ROUTING_LIVE` and `ENABLE_SQUARE_INTEGRATION` after redeploy).
2. If `orderRoutingMode !== "square"`: blocker *"Order routing mode is not Square"* — save Square routing mode first.
3. If prerequisites pass but `squareOrderRoutingEnabled === false`: blocker *"Square order injection is disabled"* — **Enable** button should now be active.
4. After enabling: if `SQUARE_ROUTING_LIVE=true`, routing readiness becomes **ready**; if false, blocker shows global kill switch (injection configured but API calls blocked).

**Primary blocker before this fix:** enable button permanently disabled due to circular readiness check.

---

## Tests / QA

| # | Scenario | Status |
|---|----------|--------|
| 1 | `SQUARE_ROUTING_LIVE=true` in admin diagnostics | ✅ |
| 2 | `SQUARE_ROUTING_LIVE=false` shows global kill switch blocker | ✅ |
| 3 | `ENABLE_SQUARE_INTEGRATION=false` shows unavailable | ✅ |
| 4 | `orderRoutingMode=square`, `squareOrderRoutingEnabled=false` shows injection disabled | ✅ |
| 5 | Admin can enable when prerequisites pass | ✅ |
| 6 | Enable revalidates `/admin/vendors/[vendorId]` | ✅ |
| 7 | Manual vendors unaffected by `SQUARE_ROUTING_LIVE` in vendor blockers | ✅ |
| 8 | Deliverect vendors unaffected | ✅ |
| 9 | No secrets in diagnostics JSON | ✅ |
| 10 | Build passes | ✅ |

---

## How to verify in production

1. Redeploy after env changes.
2. Open `/admin/vendors/<vendorId>` — confirm diagnostics panel.
3. Open `/admin/vendors/<vendorId>/square-routing-debug` — confirm JSON matches panel.
4. If prerequisites green and mode is Square, enable injection and refresh — `squareOrderRoutingEnabled` should be `true`.
