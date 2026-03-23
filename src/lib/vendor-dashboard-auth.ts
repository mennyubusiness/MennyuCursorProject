/**
 * Vendor dashboard access (Phase 1 unified auth):
 * 1) Mennyu platform admin: `mennyu_admin` cookie / `?admin=` **or** `User.isPlatformAdmin` session
 * 2) Preferred: Auth.js session + VendorMembership for vendorId
 * 3) Legacy: Vendor.vendorDashboardToken via Bearer or mennyu_vdash_{vendorId} cookie (migration / automation)
 * Development: open unless overridden.
 */
import "server-only";
import { timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ADMIN_COOKIE_NAME, isAdminAccessFromRequest, isAdminAllowed } from "@/lib/admin-auth";
import { env } from "@/lib/env";

export const vendorDashboardCookieName = (vendorId: string) => `mennyu_vdash_${vendorId}`;

export function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** True when vendor dashboard routes should skip auth checks (local dev only). */
export function isVendorDashboardDevOpen(): boolean {
  return env.NODE_ENV === "development";
}

export type VendorAccessMode = "session" | "legacy" | "dev" | "admin";

export type VendorAccessResult =
  | { ok: true; mode: VendorAccessMode; userId?: string }
  | { ok: false };

/**
 * True if the caller may view/act in this vendor area: dev, admin cookie, session+membership, or legacy cookie/Bearer.
 */
export async function canAccessVendorDashboard(vendorId: string): Promise<boolean> {
  if (isVendorDashboardDevOpen()) return true;

  const cookieStore = await cookies();
  if (isAdminAllowed(cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null, null)) {
    return true;
  }

  const session = await auth();
  if (session?.user?.isPlatformAdmin) {
    return true;
  }
  if (session?.user?.id) {
    const m = await prisma.vendorMembership.findUnique({
      where: { userId_vendorId: { userId: session.user.id, vendorId } },
    });
    if (m) return true;
    return false;
  }

  const v = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { vendorDashboardToken: true },
  });
  if (!v?.vendorDashboardToken?.trim()) return false;
  const c = cookieStore.get(vendorDashboardCookieName(vendorId))?.value;
  return Boolean(c && timingSafeStringEqual(c.trim(), v.vendorDashboardToken.trim()));
}

/**
 * API routes (publish, discard, etc.): admin secret, session + membership, else legacy token.
 */
export async function verifyVendorAccessForApi(
  vendorId: string,
  request: Request,
  vendorDashboardToken: string | null
): Promise<VendorAccessResult> {
  if (isVendorDashboardDevOpen()) {
    return { ok: true, mode: "dev" };
  }

  if (isAdminAccessFromRequest(request)) {
    return { ok: true, mode: "admin" };
  }

  const session = await auth();
  if (session?.user?.isPlatformAdmin) {
    return { ok: true, mode: "admin", userId: session.user.id };
  }
  if (session?.user?.id) {
    const m = await prisma.vendorMembership.findUnique({
      where: {
        userId_vendorId: { userId: session.user.id, vendorId },
      },
    });
    if (m) {
      return { ok: true, mode: "session", userId: session.user.id };
    }
  }

  if (vendorDashboardToken?.trim()) {
    const legacy = await verifyLegacyVendorDashboardToken(vendorId, request, vendorDashboardToken);
    if (legacy) {
      return { ok: true, mode: "legacy" };
    }
  }

  return { ok: false };
}

async function verifyLegacyVendorDashboardToken(
  vendorId: string,
  request: Request,
  vendorDashboardToken: string | null
): Promise<boolean> {
  if (!vendorDashboardToken?.trim()) return false;
  const expected = vendorDashboardToken.trim();

  const authz = request.headers.get("authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : null;
  if (bearer && timingSafeStringEqual(bearer, expected)) return true;

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const name = `${vendorDashboardCookieName(vendorId)}=`;
    const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(name));
    if (match) {
      const value = decodeURIComponent(match.slice(name.length));
      if (timingSafeStringEqual(value, expected)) return true;
    }
  }

  return false;
}

export type VendorDashboardUiAuth = {
  actionsUnlocked: boolean;
  showSignInBanner: boolean;
  showLegacyCookieBanner: boolean;
  showProvisionBanner: boolean;
  callbackUrl: string;
};

/**
 * Server components: banners for menu/settings when publish is blocked.
 */
export async function getVendorDashboardUiAuth(vendorId: string): Promise<VendorDashboardUiAuth> {
  const callbackUrl = `/vendor/${vendorId}/menu-imports`;
  const v = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { vendorDashboardToken: true },
  });
  const hasLegacySecret = Boolean(v?.vendorDashboardToken?.trim());

  if (isVendorDashboardDevOpen()) {
    return {
      actionsUnlocked: true,
      showSignInBanner: false,
      showLegacyCookieBanner: false,
      showProvisionBanner: false,
      callbackUrl,
    };
  }

  const unlocked = await canAccessVendorDashboard(vendorId);
  if (unlocked) {
    return {
      actionsUnlocked: true,
      showSignInBanner: false,
      showLegacyCookieBanner: false,
      showProvisionBanner: false,
      callbackUrl,
    };
  }

  const session = await auth();
  if (session?.user?.id) {
    return {
      actionsUnlocked: false,
      showSignInBanner: false,
      showLegacyCookieBanner: false,
      showProvisionBanner: true,
      callbackUrl,
    };
  }

  if (hasLegacySecret) {
    return {
      actionsUnlocked: false,
      showSignInBanner: false,
      showLegacyCookieBanner: true,
      showProvisionBanner: false,
      callbackUrl,
    };
  }

  return {
    actionsUnlocked: false,
    showSignInBanner: true,
    showLegacyCookieBanner: false,
    showProvisionBanner: true,
    callbackUrl,
  };
}
