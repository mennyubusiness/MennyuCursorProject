import "server-only";

import { cookies } from "next/headers";
import { PodMembershipRole, VendorMembershipRole } from "@prisma/client";
import { ADMIN_COOKIE_NAME, isAdminAllowed } from "@/lib/admin-auth";
import { env } from "@/lib/env";
import { isUserEmailVerified } from "@/lib/auth/email-verification-status";
import { prisma } from "@/lib/db";

export const VERIFY_EMAIL_REQUIRED_PATH = "/account/verify-email-required";

export { isUserEmailVerified };

export type SensitiveEmailAccessContext = {
  isPlatformAdmin: boolean;
  vendorOwner: boolean;
  podOwner: boolean;
};

export async function loadSensitiveEmailAccessContext(
  userId: string
): Promise<SensitiveEmailAccessContext | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      vendorMemberships: { select: { role: true } },
      podMemberships: { select: { role: true } },
    },
  });
  if (!user) return null;

  return {
    isPlatformAdmin: user.isPlatformAdmin,
    vendorOwner: user.vendorMemberships.some((m) => m.role === VendorMembershipRole.owner),
    podOwner: user.podMemberships.some((m) => m.role === PodMembershipRole.owner),
  };
}

export async function userRequiresVerifiedEmailForSensitiveAccess(userId: string): Promise<boolean> {
  const ctx = await loadSensitiveEmailAccessContext(userId);
  if (!ctx) return false;
  return ctx.isPlatformAdmin || ctx.vendorOwner || ctx.podOwner;
}

export async function loadUserEmailVerificationState(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerificationLastSentAt: true,
      disabledAt: true,
      isPlatformAdmin: true,
    },
  });
}

export async function assertVerifiedEmailForSensitiveAccess(userId: string): Promise<{
  ok: true;
} | { ok: false; redirectTo: string }> {
  const user = await loadUserEmailVerificationState(userId);
  if (!user || user.disabledAt) return { ok: true };
  if (isUserEmailVerified(user.emailVerified)) return { ok: true };

  const requires = await userRequiresVerifiedEmailForSensitiveAccess(userId);
  if (!requires) return { ok: true };

  return { ok: false, redirectTo: VERIFY_EMAIL_REQUIRED_PATH };
}

/** Skip gating in local dev or when using the ADMIN_SECRET bridge (not session). */
export async function shouldSkipEmailVerificationGate(): Promise<boolean> {
  if (env.NODE_ENV === "development") return true;
  const cookieStore = await cookies();
  return isAdminAllowed(cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null, null);
}

export function getPlatformAdminEmailVerificationRedirect(input: {
  isPlatformAdmin: boolean;
  emailVerified: boolean;
}): string | null {
  if (!input.isPlatformAdmin || input.emailVerified) return null;
  return VERIFY_EMAIL_REQUIRED_PATH;
}

export async function getVendorDashboardEmailVerificationRedirect(input: {
  userId: string;
  vendorId: string;
  emailVerified: boolean;
}): Promise<string | null> {
  if (input.emailVerified) return null;

  const membership = await prisma.vendorMembership.findUnique({
    where: { userId_vendorId: { userId: input.userId, vendorId: input.vendorId } },
    select: { role: true },
  });
  if (!membership) return null;

  return VERIFY_EMAIL_REQUIRED_PATH;
}

export async function getPodDashboardEmailVerificationRedirect(input: {
  userId: string;
  podId: string;
  emailVerified: boolean;
}): Promise<string | null> {
  if (input.emailVerified) return null;

  const membership = await prisma.podMembership.findUnique({
    where: { userId_podId: { userId: input.userId, podId: input.podId } },
    select: { role: true },
  });
  if (membership?.role !== PodMembershipRole.owner) return null;

  return VERIFY_EMAIL_REQUIRED_PATH;
}
