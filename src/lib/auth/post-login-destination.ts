/**
 * Post-login routing for /login — vendor flow fully implemented; customer intent redirects to
 * the order hub (/orders or a safe callback); pod/admin have separate handling.
 */
import "server-only";
import { prisma } from "@/lib/db";
import type { LoginIntent } from "@/lib/auth/login-intent";
import { extractVendorIdFromVendorPath } from "@/lib/auth/login-intent";

export type PostLoginDestinationResult =
  | { kind: "redirect"; path: string }
  | { kind: "no_access"; headline: string; body: string }
  | { kind: "coming_soon"; headline: string; body: string };

function safeInternalPath(raw: string | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

/** Safe redirects after customer-intent email sign-in (order hub + browse; never vendor/admin). */
function isCustomerHubRedirectPath(path: string): boolean {
  const clean = path.split("?")[0]?.trim() ?? "";
  if (!clean.startsWith("/")) return false;
  if (clean === "/orders" || clean === "/explore" || clean === "/cart" || clean === "/") return true;
  if (clean.startsWith("/pod/")) return true;
  if (clean.startsWith("/order/")) return true;
  return false;
}

export async function resolvePostLoginDestination(
  userId: string,
  intent: LoginIntent,
  callbackUrl: string | null
): Promise<PostLoginDestinationResult> {
  if (intent === "admin") {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { isPlatformAdmin: true },
    });
    if (u?.isPlatformAdmin) {
      return { kind: "redirect", path: "/admin" };
    }
    return {
      kind: "coming_soon",
      headline: "No Mennyu team access on this account",
      body: "You’re signed in, but this account isn’t marked as a platform admin. Ask your team to grant access, or use the admin secret link you were given. The vendor area still works if you have a restaurant membership.",
    };
  }

  if (intent === "customer") {
    const cb = safeInternalPath(callbackUrl);
    if (cb && isCustomerHubRedirectPath(cb)) {
      return { kind: "redirect", path: cb };
    }
    return { kind: "redirect", path: "/orders" };
  }

  if (intent === "pod") {
    return {
      kind: "coming_soon",
      headline: "This area isn’t connected yet",
      body: "You’re signed in. Pod access for your account is not enabled yet. Choose Vendor if you manage a restaurant.",
    };
  }

  const memberships = await prisma.vendorMembership.findMany({
    where: { userId },
    select: { vendorId: true },
  });

  const vendorIds = new Set(memberships.map((m) => m.vendorId));
  const callbackPath = safeInternalPath(callbackUrl);
  const vendorFromCallback = callbackPath ? extractVendorIdFromVendorPath(callbackPath) : null;

  if (vendorFromCallback) {
    if (vendorIds.has(vendorFromCallback)) {
      return { kind: "redirect", path: callbackPath! };
    }
    return {
      kind: "no_access",
      headline: "No access to this vendor",
      body: "You’re signed in, but this email isn’t linked to that restaurant. Ask an owner to invite you, or switch accounts.",
    };
  }

  if (memberships.length === 0) {
    return {
      kind: "no_access",
      headline: "No vendor access yet",
      body: "You’re signed in, but you’re not linked to a restaurant on Mennyu yet. Ask your team to invite this email, or contact support.",
    };
  }

  if (memberships.length === 1) {
    return { kind: "redirect", path: `/vendor/${memberships[0].vendorId}` };
  }

  return { kind: "redirect", path: "/vendor/select" };
}
