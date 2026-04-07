/**
 * Post-login routing: optional safe callbackUrl, else role-based default
 * (admin → /admin, vendor → /vendor/dashboard, pod → /pod/dashboard, else /orders).
 */
import "server-only";

import { extractVendorIdFromVendorPath } from "@/lib/auth/login-intent";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { prisma } from "@/lib/db";
import { canViewPod, canViewVendor, getUserAccessContext, isAdminUser } from "@/lib/permissions";

export type PostLoginDestinationResult = { kind: "redirect"; path: string };

function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

async function canRedirectToPath(userId: string, path: string): Promise<boolean> {
  const clean = path.split("?")[0]?.trim() ?? "";
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
    clean === "/orders" ||
    clean === "/explore" ||
    clean === "/cart" ||
    clean === "/" ||
    clean === "/register"
  ) {
    return true;
  }
  if (clean.startsWith("/order/")) return true;
  if (clean.startsWith("/account/")) return true;

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
    return { kind: "redirect", path: "/orders" };
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

  return { kind: "redirect", path: "/orders" };
}

export async function resolvePostLoginDestination(
  userId: string,
  callbackUrl: string | null
): Promise<PostLoginDestinationResult> {
  const pendingSetup = await getPendingAccountSetupRedirect(userId);
  if (pendingSetup) {
    return { kind: "redirect", path: pendingSetup };
  }

  const cb = safeInternalPath(callbackUrl);
  if (cb) {
    const allowed = await canRedirectToPath(userId, cb);
    if (allowed) {
      return { kind: "redirect", path: cb };
    }
  }

  return resolveDefaultDestinationForUser(userId);
}
