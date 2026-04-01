/**
 * Central server-side authorization for contextual memberships (vendor, pod) and platform admin.
 * Use from layouts, server actions, and route handlers — not a generic RBAC engine.
 */
import "server-only";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdminApiRequestAuthorized, isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";

/** No NextAuth session / user id. */
export function isGuestSession(session: Session | null): boolean {
  return !session?.user?.id;
}

/** Authenticated user without implying vendor/pod/admin (caller may combine with DB checks). */
export function isAuthenticatedSession(session: Session | null): boolean {
  return Boolean(session?.user?.id);
}

export function isPlatformAdminSession(session: Session | null): boolean {
  return Boolean(session?.user?.isPlatformAdmin);
}

/** Platform admin via session only (not ADMIN_SECRET bridge). */
export async function isAdminUser(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });
  return Boolean(u?.isPlatformAdmin);
}

/** Alias: global platform admin from NextAuth session (JWT). */
export const canViewAdmin = isPlatformAdminSession;

/** Alias: global platform admin from DB (e.g. server actions with userId only). */
export const canViewAdminUser = isAdminUser;

/**
 * Vendor area: membership for vendorId or platform admin.
 * Does not include legacy token or admin cookie (see vendor-dashboard-auth).
 */
export async function canViewVendor(userId: string, vendorId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;
  const m = await prisma.vendorMembership.findUnique({
    where: { userId_vendorId: { userId, vendorId } },
  });
  return Boolean(m);
}

/** Same as view until owner-only actions are split out. */
export async function canManageVendor(userId: string, vendorId: string): Promise<boolean> {
  return canViewVendor(userId, vendorId);
}

/**
 * Pod area: PodMembership or platform admin.
 */
export async function canViewPod(userId: string, podId: string): Promise<boolean> {
  if (await isAdminUser(userId)) return true;
  const m = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId, podId } },
  });
  return Boolean(m);
}

/** Owner or manager (or admin). Extend with role-specific rules later. */
export async function canManagePod(userId: string, podId: string): Promise<boolean> {
  return canViewPod(userId, podId);
}

export type UserAccessContext = {
  userId: string;
  isPlatformAdmin: boolean;
  vendorIds: string[];
  podIds: string[];
};

export async function getUserAccessContext(userId: string): Promise<UserAccessContext | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      vendorMemberships: { select: { vendorId: true } },
      podMemberships: { select: { podId: true } },
    },
  });
  if (!u) return null;
  return {
    userId,
    isPlatformAdmin: u.isPlatformAdmin,
    vendorIds: u.vendorMemberships.map((m) => m.vendorId),
    podIds: u.podMemberships.map((m) => m.podId),
  };
}

/**
 * RSC pod dashboard layout: dev open (matches admin layout), admin bridge/session, or pod membership.
 */
export async function canAccessPodDashboardLayout(podId: string): Promise<boolean> {
  if (await isAdminDashboardLayoutAuthorized()) return true;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return false;
  return canViewPod(userId, podId);
}

/**
 * Pod HTTP APIs: dev bypass (via admin API check), admin bridge, platform admin session, or pod membership.
 */
export async function assertPodApiAccess(
  request: Request,
  podId: string
): Promise<{ ok: true; userId?: string } | { ok: false; status: number }> {
  if (await isAdminApiRequestAuthorized(request)) {
    return { ok: true };
  }
  const session = await auth();
  if (session?.user?.isPlatformAdmin) {
    return { ok: true, userId: session.user.id };
  }
  const userId = session?.user?.id;
  if (!userId) {
    return { ok: false, status: 401 };
  }
  const allowed = await canViewPod(userId, podId);
  if (!allowed) {
    return { ok: false, status: 403 };
  }
  return { ok: true, userId };
}
