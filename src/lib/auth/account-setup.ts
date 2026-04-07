/**
 * Guided registration: role selection + role-specific profile tables.
 * Auth identity (User) is separate from memberships (VendorMembership, PodMembership) and CustomerProfile.
 */
import "server-only";
import { RegistrationIntent } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  ACCOUNT_ROLE_PATH,
  ACCOUNT_SETUP_CUSTOMER_PATH,
  ACCOUNT_SETUP_POD_PATH,
  ACCOUNT_SETUP_VENDOR_PATH,
} from "@/lib/auth/account-paths";

/**
 * Returns the next setup URL for a signed-in user, or null if no guided step is pending.
 * Platform admins skip forced onboarding so internal accounts are never blocked.
 */
export async function getPendingAccountSetupRedirect(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPlatformAdmin: true,
      needsAccountRoleSelection: true,
      registrationIntent: true,
      customerProfile: { select: { id: true, firstName: true, lastName: true } },
      vendorMemberships: { select: { id: true }, take: 1 },
      podMemberships: { select: { id: true }, take: 1 },
    },
  });
  if (!user) return null;
  if (user.isPlatformAdmin) return null;

  if (user.needsAccountRoleSelection && !user.registrationIntent) {
    return ACCOUNT_ROLE_PATH;
  }

  if (user.registrationIntent === RegistrationIntent.customer) {
    const p = user.customerProfile;
    if (!p?.firstName?.trim() || !p?.lastName?.trim()) {
      return ACCOUNT_SETUP_CUSTOMER_PATH;
    }
    return null;
  }

  if (user.registrationIntent === RegistrationIntent.vendor) {
    if (user.vendorMemberships.length === 0) {
      return ACCOUNT_SETUP_VENDOR_PATH;
    }
    return null;
  }

  if (user.registrationIntent === RegistrationIntent.pod_owner) {
    if (user.podMemberships.length === 0) {
      return ACCOUNT_SETUP_POD_PATH;
    }
    return null;
  }

  return null;
}
