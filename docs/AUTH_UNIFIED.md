# Mennyu unified authentication (current)

This document complements `AUTH_PHASE1.md` with the **registration** path and a clear split between **primary human access** and **secondary automation / bootstrap** mechanisms.

## Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/login` | Email + password via NextAuth; intent selector (vendor / pod / customer / admin) | **Canonical** sign-in |
| `/register` | Create `User`, then `/account/role` → role-specific setup | **Canonical** new accounts |
| `/account/*` | Role selection and customer/vendor/pod profile setup | **Canonical** onboarding shell |

There is **no separate legacy login page** — a single login page serves all intents.

---

## Primary auth (intended for people)

1. **NextAuth** session (`/login`) with a `User` record.
2. **Vendor dashboard:** `VendorMembership` linking that user to the vendor.
3. **Pod dashboard:** `PodMembership` linking that user to the pod.

**This is the default and recommended path** for restaurant staff and pod operators. Vendor Settings copy reflects sign-in + membership first.

---

## Secondary: API access key + temporary links (not “login”)

The field **`Vendor.vendorDashboardToken`** stores a **long-lived API access key** (implementation name unchanged in the database). It is **not** a user password and **not** Deliverect/POS credentials.

### What it is for

| Use | Description |
|-----|-------------|
| **Automation / APIs** | `Authorization: Bearer <key>` on Mennyu vendor HTTP APIs (scripts, CI, integrations). |
| **Browser bootstrap** | Same value can be stored in an **httpOnly cookie** so a browser session can act as that vendor without a NextAuth `User` — **fallback** for tooling and edge cases. |
| **Temporary access link** | Admin calls `POST /api/admin/vendors/{vendorId}/dashboard-access-link`. The returned URL hits `GET /api/vendor/{vendorId}/session/grant?token=...` where `token` is a **signed, short-lived ticket** (`VENDOR_ACCESS_SIGNING_SECRET`), **not** the raw key in the URL. The grant handler sets the cookie to the stored key value. |

### What we call it in product UI

- **“API access key”** or **“automation”** — not “dashboard token” or “login token”.
- **“Temporary access link”** — not a replacement for signing in; onboarding / admin-assisted browser binding.

Manual **paste-the-key-in-the-browser** exists only under **Settings → Automation & API access → Technical**, for rare operator workflows. Prefer **Sign in** or a **temporary access link**.

---

## Three technical layers (unchanged behavior)

1. **Preferred (humans):** NextAuth + membership.
2. **Admin bridge:** `mennyu_admin` cookie / `?admin=` matching `ADMIN_SECRET` (support tooling).
3. **Secondary:** API access key → Bearer and/or cookie; signed grant URL for cookie bootstrap.

---

## What we are not building here

- No in-app forgot-password flow yet (none in codebase).
- Customer checkout **phone session** remains separate from NextAuth (by design).

## End-state summary

| Actor | Primary | Secondary |
|-------|---------|-----------|
| Restaurant staff | `User` + `VendorMembership` → `/login?intent=vendor` | Temporary access link; API key for automation |
| Automation / CI | — | Bearer API access key |
| Pod managers | `User` + `PodMembership` → `/login?intent=pod` | Admin bridge as needed |

The API access key field remains in the schema until integrations move to OAuth/service accounts or scoped keys.
