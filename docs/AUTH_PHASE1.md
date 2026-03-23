# Unified auth — Phase 1

## A. Architecture (recommended)

- **Single identity:** `User` (email + optional `passwordHash`; room for OAuth / magic link later).
- **Sessions:** **Auth.js (NextAuth v5)** with **Credentials** provider and **JWT strategy** (encrypted **httpOnly** session cookie `authjs.session-token` — name may vary by version).
- **Authorization:** **membership tables** per domain — Phase 1: `VendorMembership` (`userId` + `vendorId` + `role`). Future: `PodMembership`, `Customer` profile, `User.isPlatformAdmin` or `PlatformRole`, etc.
- **Admin (temporary):** existing `ADMIN_SECRET` cookie/query unchanged until Phase N binds admin to `User`.

This is **one** auth system (same `User`, same session cookie); vendor vs pod vs customer is **data**, not separate login stacks.

## B. Prisma (Phase 1)

- **`User`** — `email` unique, `passwordHash` (bcrypt), `emailVerified`, `name`, `image`.
- **`VendorMembership`** — `@@unique([userId, vendorId])`, `role` `owner` | `staff`.
- **Legacy:** `Vendor.vendorDashboardToken` kept for Bearer automation and magic-link cookie bootstrap; prefer session + membership for humans.

Migration: `prisma/migrations/20250315130000_unified_auth_user_vendor_membership/`.

## C. Vendor access control (real sessions)

| Check | Behavior |
|--------|----------|
| **Preferred** | `auth()` session + `VendorMembership` for URL `vendorId` |
| **Legacy** | `Authorization: Bearer` or `mennyu_vdash_{vendorId}` cookie matches `vendorDashboardToken` |
| **Dev** | `NODE_ENV === "development"` — open (existing behavior) |

- **API:** `verifyVendorAccessForApi` in `src/lib/vendor-dashboard-auth.ts`.
- **UI:** `canAccessVendorDashboard` in vendor layout — redirect to `/login` or legacy settings if not allowed.
- **Publish audit:** `publishedBy` = `user:{userId}` when session auth, else `vendor:{vendorId}` for legacy.

## D. Safest implementation order

1. Apply migration + `npx prisma generate`.
2. `npm install` (adds `next-auth`, `bcryptjs`).
3. Set **`AUTH_SECRET`** in production (≥32 chars).
4. Create vendor users: **`POST /api/admin/vendor-users`** (admin auth) or seed (`vendor@mennyu.local` / `mennyu-dev-password` → Taco Fiesta).
5. Vendors sign in at **`/login`**, then open `/vendor/{vendorId}/...`.
6. Retire reliance on token paste for day-to-day; keep legacy token for scripts until removed.

## Environment

| Variable | Notes |
|----------|--------|
| `AUTH_SECRET` | Required in production for JWT signing. |
| `VENDOR_ACCESS_SIGNING_SECRET` | Still used for magic-link grant route (optional migration path). |

## API

- `POST /api/admin/vendor-users` — body `{ email, password, vendorId, role? }` — creates `User` + `VendorMembership`.

## Files (reference)

- `src/auth.ts` — Auth.js config.
- `src/app/api/auth/[...nextauth]/route.ts` — route handlers.
- `src/lib/auth/password.ts` — bcrypt hash/verify.
- `src/lib/vendor-dashboard-auth.ts` — vendor checks.
- `src/app/login/*` — sign-in UI.
