import type { Session } from "next-auth";

import type { CustomerSessionInfo } from "@/lib/customer-session";
import { formatMaskedCustomerPhone } from "@/lib/phone";

export type AccountCheckoutPhone = {
  phoneDisplay: string;
};

export type AccountEmailIdentity = {
  email: string;
  name: string | null;
};

export type AccountStaffIdentity = {
  email: string;
  name: string | null;
  isPlatformAdmin: boolean;
  vendorMemberships: Array<{
    vendorName: string;
    role: string;
    href: string;
  }>;
  podMemberships: Array<{
    podName: string;
    role: string;
    href: string;
  }>;
  showAdminLink: boolean;
};

export type AccountPageContext = {
  /** Signed-in User (email/password). Required for /account. */
  emailAccount: AccountEmailIdentity | null;
  /** Checkout phone session on this device — contact info only, not a separate account. */
  checkoutPhone: AccountCheckoutPhone | null;
  staff: AccountStaffIdentity | null;
  isSignedIn: boolean;
};

type StaffMembershipInput = {
  isPlatformAdmin: boolean;
  vendorMemberships: Array<{ vendorId: string; role: string; vendor: { name: string } }>;
  podMemberships: Array<{ podId: string; role: string; pod: { name: string } }>;
};

function isOperationalUser(memberships: StaffMembershipInput): boolean {
  return (
    memberships.isPlatformAdmin ||
    memberships.vendorMemberships.length > 0 ||
    memberships.podMemberships.length > 0
  );
}

export function buildAccountPageContext(input: {
  customerSession: CustomerSessionInfo | null;
  customerAccount: {
    phoneE164: string;
    phoneVerifiedAt: Date | null;
  } | null;
  session: Session | null;
  staffMemberships: StaffMembershipInput | null;
  showAdminLink: boolean;
}): AccountPageContext {
  const staffUser = input.session?.user;
  const emailAccount =
    staffUser?.id && staffUser.email
      ? {
          email: staffUser.email,
          name: staffUser.name?.trim() || null,
        }
      : null;

  const checkoutPhone =
    emailAccount && input.customerSession && input.customerAccount
      ? {
          phoneDisplay: formatMaskedCustomerPhone(input.customerAccount.phoneE164),
        }
      : null;

  const staff =
    staffUser?.id && staffUser.email && input.staffMemberships && isOperationalUser(input.staffMemberships)
      ? {
          email: staffUser.email,
          name: staffUser.name?.trim() || null,
          isPlatformAdmin: input.staffMemberships.isPlatformAdmin,
          vendorMemberships: input.staffMemberships.vendorMemberships.map((m) => ({
            vendorName: m.vendor.name,
            role: m.role,
            href: `/vendor/${m.vendorId}`,
          })),
          podMemberships: input.staffMemberships.podMemberships.map((m) => ({
            podName: m.pod.name,
            role: m.role,
            href: `/pod/${m.podId}/dashboard`,
          })),
          showAdminLink: input.showAdminLink,
        }
      : null;

  return {
    emailAccount,
    checkoutPhone,
    staff,
    isSignedIn: Boolean(emailAccount),
  };
}
