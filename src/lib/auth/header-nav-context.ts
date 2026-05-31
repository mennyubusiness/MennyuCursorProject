/**
 * Server-only: derive global header nav mode from User memberships.
 * Used by root layout — keep in sync with post-login routing (see post-login-destination.ts).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { buildHeaderAccountRoleHint } from "@/lib/auth/header-account-menu";
import type { HeaderNavContext } from "@/lib/auth/header-nav-types";

export type { HeaderNavContext, HeaderNavMode } from "@/lib/auth/header-nav-types";

const emptyNavContext: HeaderNavContext = {
  mode: "guest",
  dashboardHref: null,
  accountLabel: null,
  accountMenu: null,
};

async function contextForUserId(userId: string): Promise<HeaderNavContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      name: true,
      isPlatformAdmin: true,
      vendorMemberships: {
        select: { vendorId: true, vendor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
      podMemberships: {
        select: { podId: true, pod: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) {
    return emptyNavContext;
  }

  const vendorCount = user.vendorMemberships.length;
  const podCount = user.podMemberships.length;

  const accountMenu = {
    email: user.email,
    name: user.name?.trim() || null,
    roleHint: buildHeaderAccountRoleHint({
      isPlatformAdmin: user.isPlatformAdmin,
      vendorCount,
      podCount,
    }),
    adminDashboardHref: user.isPlatformAdmin ? "/admin" : null,
    vendorDashboardHref:
      vendorCount === 1 ? `/vendor/${user.vendorMemberships[0].vendorId}` : null,
    vendorDashboardLabel: vendorCount === 1 ? user.vendorMemberships[0].vendor.name : null,
    podDashboardHref:
      podCount === 1 ? `/pod/${user.podMemberships[0].podId}/dashboard` : null,
    podDashboardLabel: podCount === 1 ? user.podMemberships[0].pod.name : null,
  };

  if (user.isPlatformAdmin) {
    return { mode: "admin", dashboardHref: "/admin", accountLabel: "Admin", accountMenu };
  }

  if (vendorCount > 0) {
    const v = user.vendorMemberships;
    const href = v.length === 1 ? `/vendor/${v[0].vendorId}` : "/vendor/select";
    return { mode: "vendor", dashboardHref: href, accountLabel: "Vendor", accountMenu };
  }

  if (podCount > 0) {
    const podId = user.podMemberships[0].podId;
    return { mode: "pod", dashboardHref: `/pod/${podId}/dashboard`, accountLabel: "Pod", accountMenu };
  }

  return { mode: "customer", dashboardHref: null, accountLabel: null, accountMenu };
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
      return { mode: "customer", dashboardHref: null, accountLabel: null, accountMenu: null };
    }
    return emptyNavContext;
  }

  return contextForUserId(userId);
}
