# Platform admin (`User.isPlatformAdmin`)

Same **User** + NextAuth session as vendors. Complements the temporary **ADMIN_SECRET** / `mennyu_admin` cookie.

## Schema

- `User.isPlatformAdmin` (boolean, default `false`)

## Access

- **Dashboard / pod layouts:** `isAdminDashboardLayoutAuthorized()` — dev open, or secret cookie, or signed-in platform admin.
- **`/api/admin/*`:** `isAdminApiRequestAuthorized(request)` — same, plus `?admin=` on requests.

JWT/session include `isPlatformAdmin` at **sign-in**; after toggling the flag in DB, the user should **sign out and sign in again** (or wait for token refresh strategy if you add one later).

## Bootstrap first admin

Requires **ADMIN_SECRET** (or local dev). **Session is not accepted** on this route.

```bash
curl -X POST "$ORIGIN/api/admin/platform-admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "Cookie: mennyu_admin=YOUR_ADMIN_SECRET" \
  -d '{"email":"admin@example.com","password":"your-secure-password"}'
```

Promote an existing user (omit `password`):

```bash
curl -X POST "$ORIGIN/api/admin/platform-admin/bootstrap" \
  -H "Content-Type: application/json" \
  -H "Cookie: mennyu_admin=YOUR_ADMIN_SECRET" \
  -d '{"email":"existing@example.com"}'
```

## SQL alternative (after migration)

```sql
UPDATE "User" SET "isPlatformAdmin" = true WHERE email = 'admin@example.com';
```

Password must still be set via app or `vendor-users` API; hashes are bcrypt (see `src/lib/auth/password.ts`).

## Migrating off ADMIN_SECRET-only

1. Run migration; bootstrap at least one `isPlatformAdmin` user.
2. Team signs in at `/login` → **Mennyu team access** → `/admin`.
3. Keep `ADMIN_SECRET` for automation, emergencies, and bootstrap until you retire it.
