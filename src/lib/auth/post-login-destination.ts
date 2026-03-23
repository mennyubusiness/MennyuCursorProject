/**
 * Post-login routing for /login — vendor flow fully implemented; other intents stubbed.
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
      body: "You’re signed in, but this account isn’t marked as a platform admin. Ask your team to grant access, or use the admin secret link you were given. Vendor dashboard still works if you have a restaurant membership.",
    };
  }

  if (intent !== "vendor") {
    return {
      kind: "coming_soon",
      headline: "This area isn’t connected yet",
      body:
        intent === "pod"
          ? "You’re signed in. Pod dashboard access for your account is coming in a future update. Choose Vendor dashboard if you manage a restaurant."
          : "You’re signed in. Customer account features for this email are coming in a future update. You can still browse and order on Mennyu as usual.",
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
