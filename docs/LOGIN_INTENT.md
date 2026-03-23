# Login intent (`/login`)

- **One auth system**: NextAuth credentials + JWT session. `?intent=` only affects copy and **post-login routing** (`src/lib/auth/post-login-destination.ts`).
- **Vendor** (implemented): memberships → `/vendor/{id}`, `/vendor/select`, or no-access; `callbackUrl` under `/vendor/{id}` is honored only with membership.
- **Pod / customer / Mennyu team**: UI + “coming soon” message after sign-in; no extra DB tables in this pass.
- **Server action**: `src/app/login/actions.ts` (`resolvePostLoginDestinationAction`) — no `/api/auth/post-login` route.
