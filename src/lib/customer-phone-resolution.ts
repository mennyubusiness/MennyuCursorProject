/**
 * Resolves verified diner phone from CustomerSession (not forgeable phone cookie).
 */
import "server-only";

import { prisma } from "@/lib/db";
import { getCustomerSessionFromRequest } from "@/lib/customer-session";

export async function resolveCustomerPhoneForSession(
  headersList: Headers,
  userId: string | null
): Promise<string | null> {
  const customerSession = await getCustomerSessionFromRequest(headersList);
  if (customerSession?.phoneE164) return customerSession.phoneE164;

  if (!userId) return null;

  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { phone: true },
  });
  const fromProfile = profile?.phone?.trim();
  return fromProfile && fromProfile.length > 0 ? fromProfile : null;
}
