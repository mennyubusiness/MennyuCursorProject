# Deliverect order status webhooks — payload validation notes

Mennyu does not store raw production webhooks in-repo. This document records **assumptions validated against Deliverect docs** and **tightening** applied in `webhook-handler.ts`. After go-live, paste anonymized samples into this file and adjust field lists if needed.

## Reference shapes (documented / typical)

**Flat (common):**

```json
{
  "locationId": "...",
  "channelLinkId": "...",
  "orderId": "<deliverect-mongo-id>",
  "channelOrderId": "<mennyu-vendor-order-cuid>",
  "status": 70,
  "updatedAt": "2025-01-01T12:00:00Z"
}
```

**Wrapped:**

```json
{
  "order": {
    "channelOrderId": "<cuid>",
    "status": 50,
    "updatedAt": "..."
  }
}
```

```json
{
  "data": {
    "channelOrderId": "<cuid>",
    "status": 20
  }
}
```

## Fields Mennyu reads

| Purpose | Keys tried (in order / merged) |
|--------|----------------------------------|
| Mennyu vendor order id | `mennyuVendorOrderId`, `channelOrderId`, `channelOrderDisplayId`, `checkoutId` (only if cuid), `orderId`/`orderID` (only if cuid), nested `channelOrder.channelOrderId` / `channelOrder.id` |
| Deliverect external id | `_id`, `oid`, `deliverectOrderId`, `deliveryId`, `orderId` (when not cuid), … |
| Status code | `status`, `orderStatus`, `posOrderStatus`, `newStatus`, …; string enums e.g. `PICKUP_READY`; nested `{ code }` |
| Idempotency (message) | `webhookId`, `eventId`, `uuid`, `messageId`, `correlationId`, snake_case variants |
| Idempotency (composite) | `channelOrderId`/`ext` + `status` + `updatedAt` or body fingerprint |
| Nested merge | `order`, `data`, `orderUpdate`, `body`, `webhook` objects merged into one flat map |

## Status code → Mennyu (summary)

See `mapDeliverectStatusCodeToUpdate` in code — aligned with [order status table](https://developers.deliverect.com/page/order-status).

## How to validate with real traffic

1. Temporarily log `rawBody` + `flat` keys (no secrets) after HMAC pass, or inspect `WebhookEvent.payload` in DB.
2. For each lifecycle step (20 → 50 → 70 → 90, 110, 120), confirm `readStatusCode(flat)` and `resolveMennyuVendorOrderId(flat)` in a REPL or unit test.
3. If resolution fails, check whether Mennyu id lives under a new key — add to handler with minimal change.
