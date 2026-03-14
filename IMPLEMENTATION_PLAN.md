# Mennyu MVP – Implementation Plan (Build Order)

Build in this order so that dependencies are in place and the order routing/splitting engine is correct from the start.

## Phase 1: Foundation
1. **Project setup** – Next.js, TypeScript, Tailwind, Prisma, env (Zod). Folder structure as in `FOLDER_STRUCTURE.md`.
2. **Database** – Apply Prisma schema (`db:push` or `db:migrate`), run seed.
3. **Domain types** – `src/domain/types.ts` (Pod, Vendor, MenuItem, Cart, Order, VendorOrder, PaymentAllocation, status enums).
4. **Money & fees** – `src/domain/money.ts` (cents arithmetic), `src/domain/fees.ts` (service fee 3.5%, commission 2.75%, tip split).
5. **Order state machine** – `src/domain/order-state.ts` (parent + child states, transitions, unified display derivation).

## Phase 2: Data & Services (no UI)
6. **DB client & idempotency** – `src/lib/db.ts`, `src/lib/env.ts`, `src/lib/idempotency.ts`.
7. **Cart service** – Create/update cart by session + pod; add/update/remove items; group by vendor; validate against menu.
8. **Order service** – Split cart into parent order + vendor orders; compute allocations (subtotal, service fee, tip pro-rata, tax); persist in one transaction; record status history.
9. **Payment service** – Create Stripe PaymentIntent (amount = order total), confirm with idempotency; create Payment + PaymentAllocation records.
10. **Deliverect integration** – `integrations/deliverect`: client, payload types, transform (Mennyu vendor order → Deliverect payload), submit order with idempotency; store attempt + raw payload.
11. **SMS service** – Twilio: send order confirmation, status updates (primary channel); use templates for consistency.
12. **Order status service** – Derive unified parent status from child vendor orders; update parent status history when children change; support fallback when POS confirmation is delayed (scaffold only).

## Phase 3: API & Webhooks
13. **Cart API** – GET/POST cart (by session + pod); add/update/remove items (server actions or API routes).
14. **Checkout API** – Create order (idempotent), create PaymentIntent, return client_secret.
15. **Orders API** – Create order after payment success (Stripe webhook); trigger Deliverect submission per vendor order; idempotent.
16. **Stripe webhook** – Signature verification, idempotency (WebhookEvent), on `payment_intent.succeeded` create/confirm order and trigger routing.
17. **Deliverect webhook** – Signature verification stub, idempotency, parse event, log payload, update VendorOrder (routing/fulfillment status) and parent Order status; persist raw payload.

## Phase 4: UI
18. **Layout & home** – Root layout, nav, landing page (mennyu.com).
19. **Explore** – List pods (from DB).
20. **Pod detail** – Pod info + list vendors in pod; link to vendor menu.
21. **Vendor menu** – Menu items in pod context; add to cart (cart is pod-scoped).
22. **Cart page** – Cart grouped by vendor; edit quantities; link to checkout.
23. **Checkout page** – Contact (phone required), tip, service fee/total display; Stripe Elements; submit → create order + PaymentIntent → confirm; redirect to order status.
24. **Order status page** – Single order view; unified status and time estimate; list items by vendor; SMS opt-in/confirmation note.

## Phase 5: Admin (minimal for MVP)
25. **Admin: pods & vendors** – Create/edit pod and vendors; map vendor to Deliverect channel link ID (and optional location/account IDs). Pod-owner field in data model only if needed for v1.

## Phase 6: Polish
26. **Error handling** – User-facing messages for payment failure, routing failure, out-of-stock.
27. **Time estimates** – Store and display (e.g. “Ready in 15–20 min”); can be static per pod/vendor for MVP.
28. **Comments** – Mark “future: fallback order relay”, “future: location-based tax”, “future: pod-owner dashboard” where applicable.

---

**Critical path:** Cart → Order (split) → Payment → Deliverect (per vendor) → Webhook (status) → Unified status. Keep cart UI and order routing logic decoupled; all pricing and splitting in services/domain.
