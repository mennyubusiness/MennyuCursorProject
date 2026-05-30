import type { Session } from "next-auth";



import type { CustomerSessionInfo } from "@/lib/customer-session";

import { formatMaskedCustomerPhone } from "@/lib/phone";



export type PhoneLinkStatus =

  | "linked"

  | "linkable"

  | "linked_other"

  | "user_has_other";



export type AccountCheckoutPhone = {

  phoneDisplay: string;

  linkStatus: PhoneLinkStatus | "none";

  linkStatusLabel: string;

  canLink: boolean;

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

  /** Checkout or account-linked phone — contact info, not a separate account. */

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



function resolveCheckoutPhone(input: {

  userId: string;

  customerSession: CustomerSessionInfo | null;

  sessionCustomerAccount: {

    phoneE164: string;

    phoneVerifiedAt: Date | null;

    userId: string | null;

  } | null;

  userLinkedAccount: { id: string; phoneE164: string } | null;

}): AccountCheckoutPhone | null {

  const sessionAccount =

    input.customerSession && input.sessionCustomerAccount

      ? {

          id: input.customerSession.customerAccountId,

          phoneE164: input.sessionCustomerAccount.phoneE164,

          userId: input.sessionCustomerAccount.userId,

        }

      : null;



  if (sessionAccount) {

    const phoneDisplay = formatMaskedCustomerPhone(sessionAccount.phoneE164);



    if (sessionAccount.userId === input.userId) {

      return {

        phoneDisplay,

        linkStatus: "linked",

        linkStatusLabel: "Linked to this account",

        canLink: false,

      };

    }



    if (sessionAccount.userId && sessionAccount.userId !== input.userId) {

      return {

        phoneDisplay,

        linkStatus: "linked_other",

        linkStatusLabel: "Linked to another account",

        canLink: false,

      };

    }



    if (input.userLinkedAccount && input.userLinkedAccount.id !== sessionAccount.id) {

      return {

        phoneDisplay,

        linkStatus: "user_has_other",

        linkStatusLabel: "Not linked yet",

        canLink: false,

      };

    }



    return {

      phoneDisplay,

      linkStatus: "linkable",

      linkStatusLabel: "Not linked yet",

      canLink: true,

    };

  }



  if (input.userLinkedAccount) {

    return {

      phoneDisplay: formatMaskedCustomerPhone(input.userLinkedAccount.phoneE164),

      linkStatus: "linked",

      linkStatusLabel: "Linked to this account",

      canLink: false,

    };

  }



  return null;

}



export function buildAccountPageContext(input: {

  customerSession: CustomerSessionInfo | null;

  sessionCustomerAccount: {

    phoneE164: string;

    phoneVerifiedAt: Date | null;

    userId: string | null;

  } | null;

  userLinkedAccount: { id: string; phoneE164: string } | null;

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

    emailAccount && staffUser?.id

      ? resolveCheckoutPhone({

          userId: staffUser.id,

          customerSession: input.customerSession,

          sessionCustomerAccount: input.sessionCustomerAccount,

          userLinkedAccount: input.userLinkedAccount,

        })

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


