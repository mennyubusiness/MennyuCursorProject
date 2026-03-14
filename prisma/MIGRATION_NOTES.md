# Migration notes (schema improvements)

## Schema changes

1. **Vendor.slug** – `@unique` added. Ensure existing data has unique slugs before migrating.
2. **Cart** – `@@unique([podId, sessionId])` added. One cart per pod per session. Existing data may have duplicates; clean up before applying if needed.
3. **Enums** – `OrderStatus`, `VendorRoutingStatus`, `VendorFulfillmentStatus`, `PaymentStatus` replace string status fields on Order, VendorOrder, and Payment. Existing string values must match enum values (they do in the current codebase).
4. **Indexes** – `Order`: `@@index([stripePaymentIntentId])`. `VendorOrder`: `@@index([deliverectOrderId])`.

## Apply migration

```bash
npx prisma migrate dev --name add_enums_and_constraints
```

Or to push without a migration file (e.g. early dev):

```bash
npx prisma db push
```

## Seed compatibility

- Seed uses `Vendor` upsert by `slug` (unique) – compatible.
- Seed does not create Carts with duplicate `(podId, sessionId)` – compatible.
- Status values in seed (if any) match the new enums – no seed changes required for Order/VendorOrder/Payment.

## TypeScript

- Prisma client will export enums (e.g. `OrderStatus`, `VendorRoutingStatus`). Existing code that passes string literals (`"pending_payment"`, `"sent"`, etc.) remains valid.
- Domain types in `src/domain/types.ts` remain string unions; no change required unless you want to align them with Prisma enums.
