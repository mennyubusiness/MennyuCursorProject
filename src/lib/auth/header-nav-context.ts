/**
 * Server-only: derive global header nav mode from User memberships.
 * Used by root layout — keep in sync with post-login routing (see post-login-destination.ts).
 */
import "server-only";

import { prisma } from "@/lib/db";
import type { HeaderNavContext } from "@/lib/auth/header-nav-types";

export type { HeaderNavContext, HeaderNavMode } from "@/lib/auth/header-nav-types";

async function contextForUserId(userId: string): Promise<HeaderNavContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      vendorMemberships: { select: { vendorId: true }, orderBy: { createdAt: "asc" } },
      podMemberships: { select: { podId: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!user) {
    return { mode: "guest", dashboardHref: null, accountLabel: null };
  }

  if (user.isPlatformAdmin) {
    return { mode: "admin", dashboardHref: "/admin", accountLabel: "Admin" };
  }

  if (user.vendorMemberships.length > 0) {
    const v = user.vendorMemberships;
    const href = v.length === 1 ? `/vendor/${v[0].vendorId}` : "/vendor/select";
    return { mode: "vendor", dashboardHref: href, accountLabel: "Vendor" };
  }

  if (user.podMemberships.length > 0) {
    const podId = user.podMemberships[0].podId;
    return { mode: "pod", dashboardHref: `/pod/${podId}/dashboard`, accountLabel: "Pod" };
  }

  return { mode: "customer", dashboardHref: null, accountLabel: null };
}

/**
 * @param userId — NextAuth user id, or null when signed out
 * @param customerPhone — diner phone cookie (see getCustomerPhoneFromHeaders)
 */
export async function resolveHeaderNavContext(
  userId: string | null,
  customerPhone: string | null
): Promise<HeaderNavContext> {
  if (!userId) {
    if (customerPhone) {
      return { mode: "customer", dashboardHref: null, accountLabel: null };
    }
    return { mode: "guest", dashboardHref: null, accountLabel: null };
  }

  return contextForUserId(userId);
}
