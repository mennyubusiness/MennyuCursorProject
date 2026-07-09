# Square status sync (webhooks)

**Last updated:** 2026-07-09

One-way Square → Open Order fulfillment status sync. When staff update a Square-routed order in Square Order Manager, POS, or Dashboard, Open Order updates the matching `VendorOrder` fulfillment status.

Checkout, payouts, Square order injection, Deliverect routing, and manual/tablet routing are unchanged.

---

## Webhook subscription (Square Developer Dashboard)

1. Open your Square application → **Webhooks** → **Subscriptions** → **Add subscription**.
2. Notification URL (production):

   ```
   https://www.openorderco.com/api/webhooks/square
   ```

3. Subscribe to event:

   - `order.updated` (primary — covers UpdateOrder, Order Manager, and Dashboard edits)

4. Copy the **Signature key** into deployment env:

   | Variable | Purpose |
   |----------|---------|
   | `SQUARE_WEBHOOK_SIGNATURE_KEY` | HMAC verification (`x-square-hmacsha256-signature`) |
   | `SQUARE_WEBHOOK_NOTIFICATION_URL` | Exact URL registered in Square (recommended for signature verification) |

If `SQUARE_WEBHOOK_SIGNATURE_KEY` is unset, the webhook endpoint returns `503` and status sync is disabled. Checkout and other routing modes are unaffected.

---

## How processing works

1. `POST /api/webhooks/square` verifies signature and logs `ProviderWebhookEvent` (`provider=square`).
2. Duplicate `event_id` values are ignored idempotently.
3. For `order.updated`, extract Square `order_id` and find `VendorOrder` by `squareOrderId`.
4. Fetch latest order via vendor OAuth token (`GET /v2/orders/{id}`) — webhook body alone is not trusted.
5. Validate location matches vendor Square connection.
6. Map Square pickup fulfillment state → OO `fulfillmentStatus` (monotonic merge).
7. Apply via `applyVendorOrderStatusWithMeta` → customer SMS milestones (preparing/ready) use existing idempotency.

Admin manual sync: **Sync status from Square now** on admin order detail (same mapper, no webhook).

---

## Status mapping (initial)

| Square pickup fulfillment | Open Order fulfillment |
|---------------------------|------------------------|
| `PROPOSED` | `accepted` |
| `RESERVED` | `preparing` |
| `PREPARED` | `ready` |
| `COMPLETED` | `completed` |
| `CANCELED` / `FAILED` | `cancelled` |

Routing: `sent` → `confirmed` when Square reports progress.

Terminal OO states (`completed`, `cancelled`) do not regress to earlier Square states.

---

## Sandbox QA

1. Configure `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_NOTIFICATION_URL` on a tunnel/preview host (ngrok, etc.) or use Square sandbox webhook tester.
2. Connect sandbox vendor, import/publish menu, set `orderRoutingMode=square`, place test order (see [square-order-injection-qa.md](./square-order-injection-qa.md)).
3. In Square sandbox Order Manager, move order: preparing → ready → completed (or picked up).
4. Confirm OO admin order detail shows updated fulfillment status and `statusSync` audit.
5. Confirm customer order status page reflects ready/completed when applicable.
6. Replay same webhook `event_id` — should not duplicate SMS or status writes.
7. Use admin **Sync status from Square now** if webhooks are delayed.

---

## Observability

- `ProviderWebhookEvent` — `processingStatus` + `errorCode` (`ignored_no_match`, `ignored_non_order_update`, `failed_signature`, `failed_processing`, etc.)
- `VendorOrder.lastSquarePayload.statusSync` — last apply outcome, Square states, errors
- Admin order detail → Square routing details → **Square status sync** section

---

## Known limitations

- One-way only — OO dashboard edits do not push status to Square
- No `order.fulfillment.updated` handler in this sprint (may add later)
- No `payment.updated` handling
- Webhook URL must match Square subscription exactly for signature verification
- Requires prior successful Square order injection (`squareOrderId` on `VendorOrder`)
