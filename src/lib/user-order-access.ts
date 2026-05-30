import "server-only";

import { prisma } from "@/lib/db";

export type OrderOwnershipRow = {
  customerAccountId: string | null;
  customerEmail: string | null;
};

/** Whether a signed-in User owns this order for history/reorder (not SMS token access). */
export async function userCanAccessOrder(
  userId: string,
  userEmail: string | null | undefined,
  order: OrderOwnershipRow
): Promise<boolean> {
  const linkedAccount = await prisma.customerAccount.findFirst({
    where: { userId },
    select: { id: true },
  });
  if (linkedAccount?.id && order.customerAccountId === linkedAccount.id) {
    return true;
  }

  const normalizedEmail = userEmail?.toLowerCase().trim();
  if (normalizedEmail && order.customerEmail?.toLowerCase().trim() === normalizedEmail) {
    return true;
  }

  return false;
}

/** Link checkout CustomerAccount to signed-in User when schema supports it. */
export async function linkCustomerAccountToUser(
  customerAccountId: string,
  userId: string
): Promise<void> {
  await prisma.customerAccount.updateMany({
    where: { id: customerAccountId, userId: null },
    data: { userId },
  });
}
