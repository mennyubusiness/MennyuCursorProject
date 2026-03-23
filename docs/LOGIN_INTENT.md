# Login intent (`/login`)

- **One auth system**: NextAuth credentials + JWT session. `?intent=` only affects copy and **post-login routing** (`src/lib/auth/post-login-destination.ts`).
- **Vendor** (implemented): memberships → `/vendor/{id}`, `/vendor/select`, or no-access; `callbackUrl` under `/vendor/{id}` is honored only with membership.
- **Pod / customer**: “coming soon” after sign-in.
- **Mennyu team** (`intent=admin`): if `User.isPlatformAdmin` → `/admin`; else calm no-access copy. See `docs/PLATFORM_ADMIN.md`.
- **Server action**: `src/app/login/actions.ts` (`resolvePostLoginDestinationAction`) — no `/api/auth/post-login` route.
