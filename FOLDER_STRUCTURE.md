# Mennyu MVP – Recommended Folder Structure

```
mennyu/
├── .env.example
├── .env.local                 # Not committed; Stripe, Twilio, Deliverect, DB URL
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── IMPLEMENTATION_PLAN.md
├── FOLDER_STRUCTURE.md
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Landing / homepage
│   │   ├── globals.css
│   │   ├── explore/
│   │   │   └── page.tsx                # Explore pods
│   │   ├── pod/
│   │   │   └── [podId]/
│   │   │       └── page.tsx            # Pod detail + vendors
│   │   ├── pod/[podId]/vendor/
│   │   │   └── [vendorId]/
│   │   │       └── page.tsx            # Vendor menu in pod context
│   │   ├── cart/
│   │   │   └── page.tsx                # Cart page
│   │   ├── checkout/
│   │   │   └── page.tsx                # Checkout page
│   │   ├── order/
│   │   │   └── [orderId]/
│   │   │       └── page.tsx            # Order confirmation / status
│   │   ├── api/
│   │   │   ├── cart/
│   │   │   │   └── route.ts            # Cart CRUD (add/update/remove)
│   │   │   ├── checkout/
│   │   │   │   └── route.ts            # Create payment intent, start checkout
│   │   │   ├── orders/
│   │   │   │   └── route.ts            # Create order (idempotent)
│   │   │   ├── webhooks/
│   │   │   │   ├── stripe/
│   │   │   │   │   └── route.ts        # Stripe webhook
│   │   │   │   └── deliverect/
│   │   │   │       └── route.ts        # Deliverect status webhook
│   │   │   └── sms/
│   │   │       └── status/
│   │   │           └── route.ts        # Optional: Twilio status callback
│   │   └── admin/
│   │       └── (admin routes later)
│   │
│   ├── lib/
│   │   ├── db.ts                        # Prisma client singleton
│   │   ├── menu-import-payload-hash.ts  # Stable stringify + SHA-256 fingerprint for import payloads
│   │   ├── env.ts                       # Validated env (Zod)
│   │   ├── stripe.ts                    # Stripe client
│   │   ├── twilio.ts                    # Twilio client
│   │   └── idempotency.ts              # Idempotency key helpers
│   │
│   ├── domain/
│   │   ├── types.ts                     # Shared domain types
│   │   ├── order-state.ts               # Order state machine
│   │   ├── money.ts                     # Money arithmetic (cents)
│   │   ├── fees.ts                     # Service fee, commission, tip split
│   │   └── menu-import/                 # Deliverect-first menu canonical + validation (Phase 1A+)
│   │       ├── canonical.schema.ts      # Zod + inferred TS types
│   │       ├── issues.ts
│   │       ├── validate.ts
│   │       └── __examples__/            # Sample raw + canonical snippets
│   │
│   ├── services/
│   │   ├── cart.service.ts              # Cart business logic
│   │   ├── order.service.ts             # Order creation, splitting, allocation
│   │   ├── payment.service.ts           # Stripe payment intent, capture
│   │   ├── deliverect.service.ts       # Deliverect API + payload transform
│   │   ├── menu-import-phase1b.service.ts # Persist raw menu import + draft MenuVersion (no live menu writes)
│   │   ├── sms.service.ts              # Twilio SMS notifications
│   │   └── order-status.service.ts     # Unified status derivation, updates
│   │
│   ├── integrations/
│   │   └── deliverect/
│   │       ├── client.ts                # HTTP client for Deliverect API
│   │       ├── payloads.ts              # Request/response types
│   │       ├── transform.ts             # Mennyu order → Deliverect payload
│   │       ├── webhook-handler.ts       # Parse, verify, dispatch events
│   │       └── menu/                    # Menu JSON → canonical (no live DB writes)
│   │           ├── normalize.ts
│   │           ├── raw-helpers.ts
│   │           └── phase1a-pipeline.ts
│   │
│   ├── actions/
│   │   ├── cart.actions.ts              # Server actions: add/update cart
│   │   ├── checkout.actions.ts         # Server actions: checkout flow
│   │   └── order.actions.ts            # Server actions: order queries
│   │
│   ├── components/
│   │   ├── ui/                          # Reusable UI (buttons, inputs, cards)
│   │   ├── cart/
│   │   ├── checkout/
│   │   ├── order/
│   │   └── layout/
│   │
│   └── hooks/
│       └── use-cart.ts                  # Cart state (context or store)
```
