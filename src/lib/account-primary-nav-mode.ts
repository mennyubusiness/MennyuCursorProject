import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { resolvePrimaryNavModeFromMemberships } from "@/lib/auth/role-nav-items";
import type { LoadedAccountPageContext } from "@/lib/account-page-context";

export function resolveAccountPrimaryNavMode(ctx: LoadedAccountPageContext): HeaderNavMode {
  if (!ctx.staff) return "customer";

  return resolvePrimaryNavModeFromMemberships({
    isPlatformAdmin: ctx.staff.isPlatformAdmin,
    vendorCount: ctx.staff.vendorMemberships.length,
    podCount: ctx.staff.podMemberships.length,
  });
}
