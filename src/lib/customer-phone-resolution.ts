/**
 * Resolves diner phone for order history / header cart: cookie first, then CustomerProfile for signed-in users.
 */
import "server-only";

import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";

export async function resolveCustomerPhoneForSession(
  headersList: Headers,
  userId: string | null
): Promise<string | null> {
  const fromCookie = getCustomerPhoneFromHeaders(headersList)?.trim();
  if (fromCookie) return fromCookie;

  if (!userId) return null;

  const profile = await prisma.customerProfile.findUnique({
    where: { userId },
    select: { phone: true },
  });
  const fromProfile = profile?.phone?.trim();
  return fromProfile && fromProfile.length > 0 ? fromProfile : null;
}
