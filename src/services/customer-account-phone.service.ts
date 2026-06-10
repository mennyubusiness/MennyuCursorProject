import "server-only";

import { prisma } from "@/lib/db";
import { recordSmsOptOut } from "@/lib/sms-opt-out.service";

export type RemoveAccountPhoneResult =
  | { ok: true; removedPhoneE164: string | null }
  | { ok: false; error: string };

/**
 * Unlinks the signed-in user's phone from their account, opts out of transactional SMS,
 * and leaves the underlying CustomerAccount record intact for order history.
 */
export async function removePhoneFromUserAccount(userId: string): Promise<RemoveAccountPhoneResult> {
  const trimmedUserId = userId.trim();
  if (!trimmedUserId) {
    return { ok: false, error: "Sign in to remove your phone number." };
  }

  const account = await prisma.customerAccount.findFirst({
    where: { userId: trimmedUserId },
    select: { id: true, phoneE164: true },
  });

  if (!account) {
    return { ok: true, removedPhoneE164: null };
  }

  await prisma.customerAccount.update({
    where: { id: account.id },
    data: { userId: null },
  });

  await recordSmsOptOut(account.phoneE164);

  return { ok: true, removedPhoneE164: account.phoneE164 };
}
