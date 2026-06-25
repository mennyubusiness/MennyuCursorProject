/**
 * Post-login routing: optional safe `next` path, else role-based default.
 * Platform admins → /admin (unless `next` is an allowed admin path).
 * Customers without `next` → /explore (not account hub).
 */
import "server-only";

import { extractVendorIdFromVendorPath } from "@/lib/auth/login-intent";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { isPublicCustomerSafePath } from "@/lib/auth/customer-safe-paths";
import { appendNextQueryParam, isVendorInvitePath } from "@/lib/auth/invite-token-path";
import {
  DEFAULT_CUSTOMER_POST_LOGIN_PATH,
  isAdminReturnPath,
  sanitizeLoginReturnPath,
} from "@/lib/auth/login-return-path";
import { prisma } from "@/lib/db";
import { canViewPod, canViewVendor, getUserAccessContext, isAdminUser } from "@/lib/permissions";

export type PostLoginDestinationResult = { kind: "redirect"; path: string };

async function canRedirectToPath(userId: string, path: string): Promise<boolean> {
  const safe = sanitizeLoginReturnPath(path);
  if (!safe) return false;

  const clean = safe.split("?")[0]?.trim() ?? "";
  if (!clean.startsWith("/")) return false;

  if (isPublicCustomerSafePath(clean)) return true;

  if (clean === "/admin" || clean.startsWith("/admin/")) {
    return isAdminUser(userId);
  }

  if (clean === "/vendor/dashboard" || clean === "/vendor/select") {
    const ctx = await getUserAccessContext(userId);
    if (!ctx) return false;
    if (ctx.isPlatformAdmin) return true;
    return ctx.vendorIds.length > 0;
  }

  if (clean === "/pod/dashboard") {
    const ctx = await getUserAccessContext(userId);
    if (!ctx) return false;
    if (ctx.isPlatformAdmin) return true;
    return ctx.podIds.length > 0;
  }

  const vendorId = extractVendorIdFromVendorPath(clean);
  if (vendorId) {
    return canViewVendor(userId, vendorId);
  }

  const podSubMatch = clean.match(/^\/pod\/([^/]+)\/(.+)/);
  if (podSubMatch) {
    const podId = podSubMatch[1];
    const sub = podSubMatch[2] ?? "";
    if (sub.startsWith("vendor/")) return false;
    if (podId === "dashboard") return false;
    return canViewPod(userId, podId);
  }

  if (clean === "/account" || clean.startsWith("/account/") || clean === "/orders") {
    return true;
  }

  if (clean.startsWith("/vendor/invite/")) {
    return true;
  }

  return false;
}

async function resolveDefaultDestinationForUser(userId: string): Promise<PostLoginDestinationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      vendorMemberships: { select: { vendorId: true }, orderBy: { createdAt: "desc" } },
      podMemberships: { select: { podId: true }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) {
    return { kind: "redirect", path: DEFAULT_CUSTOMER_POST_LOGIN_PATH };
  }

  if (user.isPlatformAdmin) {
    return { kind: "redirect", path: "/admin" };
  }

  if (user.vendorMemberships.length > 0) {
    return { kind: "redirect", path: "/vendor/dashboard" };
  }

  if (user.podMemberships.length > 0) {
    return { kind: "redirect", path: "/pod/dashboard" };
  }

  return { kind: "redirect", path: DEFAULT_CUSTOMER_POST_LOGIN_PATH };
}

export async function resolvePostLoginDestination(
  userId: string,
  returnPath: string | null
): Promise<PostLoginDestinationResult> {
  const safeReturn = sanitizeLoginReturnPath(returnPath);
  const pendingSetup = await getPendingAccountSetupRedirect(userId);
  if (pendingSetup) {
    if (safeReturn && isVendorInvitePath(safeReturn)) {
      return { kind: "redirect", path: appendNextQueryParam(pendingSetup, safeReturn) };
    }
    return { kind: "redirect", path: pendingSetup };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });

  if (user?.isPlatformAdmin) {
    if (safeReturn && isAdminReturnPath(safeReturn) && (await canRedirectToPath(userId, safeReturn))) {
      return { kind: "redirect", path: safeReturn };
    }
    return { kind: "redirect", path: "/admin" };
  }

  if (safeReturn && (await canRedirectToPath(userId, safeReturn))) {
    return { kind: "redirect", path: safeReturn };
  }

  return resolveDefaultDestinationForUser(userId);
}
