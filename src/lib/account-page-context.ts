import "server-only";



import { auth } from "@/auth";

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";

import { buildAccountPageContext, type AccountPageContext } from "@/lib/account-page-view-model";

import { prisma } from "@/lib/db";

import { getCustomerSessionFromRequest } from "@/lib/customer-session";



export type {

  AccountCheckoutPhone,

  AccountEmailIdentity,

  AccountPageContext,

  AccountStaffIdentity,

  PhoneLinkStatus,

} from "@/lib/account-page-view-model";



export { buildAccountPageContext } from "@/lib/account-page-view-model";



export type LoadedAccountPageContext = AccountPageContext & {

  hasDeviceCheckoutSession: boolean;

};



export async function loadAccountPageContext(

  headersOrRequest?: Headers

): Promise<LoadedAccountPageContext> {

  const [customerSession, session, showAdminLink] = await Promise.all([

    getCustomerSessionFromRequest(headersOrRequest),

    auth(),

    isAdminDashboardLayoutAuthorized(),

  ]);



  const userId = session?.user?.id;



  const [sessionCustomerAccount, userLinkedAccount] = await Promise.all([

    customerSession

      ? prisma.customerAccount.findUnique({

          where: { id: customerSession.customerAccountId },

          select: {

            phoneE164: true,

            phoneVerifiedAt: true,

            userId: true,

          },

        })

      : Promise.resolve(null),

    userId

      ? prisma.customerAccount.findFirst({

          where: { userId },

          select: { id: true, phoneE164: true },

        })

      : Promise.resolve(null),

  ]);



  const staffMemberships = userId

    ? await prisma.user.findUnique({

        where: { id: userId },

        select: {

          isPlatformAdmin: true,

          vendorMemberships: {

            orderBy: { createdAt: "asc" },

            select: {

              vendorId: true,

              role: true,

              vendor: { select: { name: true } },

            },

          },

          podMemberships: {

            orderBy: { createdAt: "asc" },

            select: {

              podId: true,

              role: true,

              pod: { select: { name: true } },

            },

          },

        },

      })

    : null;



  const ctx = buildAccountPageContext({

    customerSession,

    sessionCustomerAccount,

    userLinkedAccount,

    session,

    staffMemberships,

    showAdminLink,

  });



  return {

    ...ctx,

    hasDeviceCheckoutSession: Boolean(customerSession && sessionCustomerAccount?.phoneVerifiedAt),

  };

}


