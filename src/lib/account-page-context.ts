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
} from "@/lib/account-page-view-model";

export { buildAccountPageContext } from "@/lib/account-page-view-model";

export async function loadAccountPageContext(
  headersOrRequest?: Headers
): Promise<AccountPageContext> {
  const [customerSession, session, showAdminLink] = await Promise.all([
    getCustomerSessionFromRequest(headersOrRequest),
    auth(),
    isAdminDashboardLayoutAuthorized(),
  ]);

  const customerAccount = customerSession
    ? await prisma.customerAccount.findUnique({
        where: { id: customerSession.customerAccountId },
        select: {
          phoneE164: true,
          phoneVerifiedAt: true,
        },
      })
    : null;

  const userId = session?.user?.id;
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

  return buildAccountPageContext({
    customerSession,
    customerAccount,
    session,
    staffMemberships,
    showAdminLink,
  });
}
