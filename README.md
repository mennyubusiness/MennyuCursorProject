# Mennyu MVP

Multi-vendor food ordering platform for food cart pods. One cart, one payment, orders split and routed to vendors via Deliverect.

## Stack

- **Next.js 15** (App Router), **TypeScript**, **TailwindCSS**
- **PostgreSQL** + **Prisma**
- **Stripe** (payments), **Twilio** (SMS), **Deliverect** (POS routing)

## Setup

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` (and Stripe/Twilio/Deliverect when ready).
2. Install and generate Prisma client:
   ```bash
   npm install
   npx prisma generate
   ```
3. Create DB and seed:
   ```bash
   npx prisma db push
   npm run db:seed
   ```
4. Run dev server:
   ```bash
   npm run dev
   ```

## Key flows

- **Cart**: Session + pod scoped; add items from multiple vendors in one pod.
- **Checkout**: Creates parent order + vendor orders (idempotent), creates Stripe PaymentIntent. After payment, `/api/orders` records payment, allocates, and sends each vendor order to Deliverect; SMS confirmation sent.
- **Status**: Parent order status is derived from child vendor orders. Deliverect webhooks update vendor order status; parent is recomputed and SMS sent.
- **Fees**: Customer service fee 3.5% of subtotal; tip split pro-rata; vendor commission 2.75%. Tax MVP = 0%.

## Project layout

See `FOLDER_STRUCTURE.md` and `IMPLEMENTATION_PLAN.md` for folder tree and build order.

## Domain

- **Order state**: `pending_payment` → `paid` → `routing` → `routed` (and partial/failed) → `accepted` → `preparing` → `ready` → `completed` (or `cancelled` / `failed`). Child vendor orders have separate routing and fulfillment statuses.
- **Idempotency**: Payment, order creation, Deliverect submit, and webhooks use idempotency keys; raw webhook payloads are stored for debugging.

## Future work (commented in code where relevant)

- Location-based tax.
- Pod-owner dashboard and invites.
- Fallback order relay (SMS or manual confirm) when POS confirmation fails.
- Real Stripe Elements on checkout (MVP simulates confirmation via `/api/orders`).
