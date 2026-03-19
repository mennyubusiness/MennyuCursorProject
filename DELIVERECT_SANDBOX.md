# Deliverect sandbox – first vendor setup

Minimum setup for one vendor to receive vendor-order-level submissions via the routing layer. All other vendors stay on manual routing.

## Per-vendor enablement (one vendor only)

- **Vendor** (DB): Set `deliverectChannelLinkId` to the Deliverect channel link ID for that vendor. Optionally set `deliverectLocationId` if the API requires it.
- **MenuItem** (DB): For every menu item that can appear in orders from this vendor, set `deliverectProductId` to the POS/product ID Deliverect expects.
- **ModifierOption** (DB): For every modifier option that can be selected on those items, set `deliverectModifierId` to the POS/modifier ID Deliverect expects.

Provider selection is vendor-order scoped: only vendor orders whose vendor (or vendor order override) has a non-empty `deliverectChannelLinkId` go through the Deliverect path; all others use the manual path.

## Environment

- `ROUTING_MODE=deliverect` – enables live submission (otherwise submission is skipped and payload is only audited).
- `DELIVERECT_API_URL` – optional; set to sandbox base URL if Deliverect uses a separate sandbox endpoint.
- `DELIVERECT_CLIENT_ID` and `DELIVERECT_CLIENT_SECRET` – optional; used for Basic auth if required by the API.

## Validation

When `ROUTING_MODE=deliverect`, submission validates that the vendor has a channel link ID and that every line item’s menu item has `deliverectProductId` and every modifier selection has `deliverectModifierId`. Fix any reported missing IDs before the first successful sandbox order.

## Logging

Outbound submissions and failures are logged with prefix `[Deliverect]` (vendorOrderId, vendorId, success/failure, deliverectOrderId or error). Use server logs to debug the first sandbox submission.

## Idempotency

If a vendor order is already in routing status `sent` with a `deliverectOrderId`, the service skips the API call and returns success to avoid duplicate submissions.

## DMA / Backoffice — changing order status (testing Mennyu ↔ Deliverect)

**This is not fixable in the Mennyu payload.** Whether you can update statuses in Deliverect’s web UI (DMA / Backoffice) depends on **Deliverect account setup and permissions**, not on fields Mennyu sends on create.

**What is typically required:**

1. **User role** – Your Deliverect user needs permission to manage orders for the **account and location** where the channel order appears (often roles such as location manager / operator; exact names vary by Deliverect product tier).
2. **Same account/location** – The order must be visible under the location linked to your channel link; sandbox vs production and channel vs POS orders can behave differently in the UI.
3. **Channel-order behaviour** – Orders ingested from a **channel** (API push) may have **different edit rules** than orders created in the POS; some transitions may only be driven by the POS or by Deliverect automation, not by manual edits in the web app.

**Action:** Confirm with your **Deliverect account admin** or **Deliverect support** which roles and UI paths allow status changes for *channel-pushed* orders in your environment. Mennyu cannot grant DMA controls; only Deliverect access configuration can.

## Order status webhook (Mennyu ingestion)

1. In Deliverect **channel link** settings, set the **Order status webhook URL** to:
   `{YOUR_APP_ORIGIN}/api/webhooks/deliverect`
2. **HMAC:** Deliverect signs the **raw POST body** with **SHA256 HMAC** (header names may include `x-deliverect-hmacsha256`, `X-Deliverect-Hmac-Signature`, etc.).  
   - **Production** (`DELIVERECT_ENV=production`, or unset with `NODE_ENV=production`): verify with `DELIVERECT_WEBHOOK_SECRET` (partner webhook secret).  
   - **Staging / sandbox:** Mennyu reads `channelLinkId` or `channelLink.id` from the **JSON body** and uses that string as the HMAC key (no need to duplicate it in env). Set `DELIVERECT_ENV=staging` (or any non-`production` value) on Vercel when `NODE_ENV` is `production` so preview builds use channel-link verification.  
3. **Invalid JSON** → **400**. **Missing secret** (no env secret in prod, or no channel link id in staging payload) → **401** with a clear message. **Bad signature** → **401** `Invalid signature`.

Payload field notes and example shapes: **`DELIVERECT_WEBHOOK_PAYLOADS.md`**.

## Admin: simulate POS status (webhook-driven)

`POST /api/admin/vendor-orders/{vendorOrderId}/simulate-deliverect-status` with JSON `{ "status": 20 }` (numeric Deliverect status code). Requires admin cookie or `?admin=SECRET`. Calls Deliverect `POST …/orderStatus/{deliverectOrderId}` only — **no local DB updates**; Mennyu changes should arrive via webhook.

Auth to Deliverect: optional **`DELIVERECT_API_KEY`** (Bearer), else existing OAuth client credentials (`DELIVERECT_CLIENT_ID` / `DELIVERECT_CLIENT_SECRET`).

**Admin UI:** On **Admin → Order detail**, when `deliverectOrderId` is set and the environment is dev, staging, or sandbox (or `SHOW_DELIVERECT_STATUS_SIM_UI=true`), a **“Sandbox: send test status to Deliverect”** control appears per vendor order.
