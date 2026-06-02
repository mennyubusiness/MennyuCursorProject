/**
 * Post-login routing: optional safe `next` path, else role-based default.
 * Platform admins → /admin (unless `next` is an allowed admin path).
 * Customers without `next` → /account (not order history).
 */
import "server-only";

import { extractVendorIdFromVendorPath } from "@/lib/auth/login-intent";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
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

  const podMatch = clean.match(/^\/pod\/([^/]+)/);
  if (podMatch) {
    const podId = podMatch[1];
    if (podId === "dashboard") return false;
    return canViewPod(userId, podId);
  }

  if (
    clean === "/account" ||
    clean.startsWith("/account/") ||
    clean === "/orders" ||
    clean === "/explore" ||
    clean === "/cart" ||
    clean === "/" ||
    clean === "/register"
  ) {
    return true;
  }
  if (clean.startsWith("/order/")) return true;

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
  const pendingSetup = await getPendingAccountSetupRedirect(userId);
  if (pendingSetup) {
    return { kind: "redirect", path: pendingSetup };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPlatformAdmin: true },
  });

  const safeReturn = sanitizeLoginReturnPath(returnPath);

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
