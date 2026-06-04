import "server-only";

import { prisma } from "@/lib/db";
import { attachLegacyOrdersToCustomerAccount } from "@/services/customer-account-orders.service";

export type LinkCheckoutPhoneErrorCode =
  | "SIGN_IN_REQUIRED"
  | "NO_CUSTOMER_SESSION"
  | "ACCOUNT_NOT_FOUND"
  | "SESSION_MISMATCH"
  | "ALREADY_LINKED_OTHER"
  | "USER_HAS_OTHER_PHONE"
  | "LINK_FAILED";

export type LinkCheckoutPhoneResult =
  | { ok: true; legacyOrdersAttached: number; alreadyLinked: boolean }
  | { ok: false; code: LinkCheckoutPhoneErrorCode; error: string };

/**
 * Links a verified checkout CustomerAccount (from CustomerSession) to a signed-in User.
 * Also attaches legacy orders with matching phone and no customerAccountId.
 */
/**
 * Links OTP-verified phone to signed-in User. If the user already had a different phone linked,
 * unlinks the prior CustomerAccount so the new verified number becomes the account phone.
 */
export async function linkVerifiedPhoneToUserAfterOtp(params: {
  userId: string;
  customerAccountId: string;
  phoneE164: string;
}): Promise<LinkCheckoutPhoneResult> {
  await prisma.customerAccount.updateMany({
    where: {
      userId: params.userId,
      id: { not: params.customerAccountId },
    },
    data: { userId: null },
  });
  return linkCheckoutCustomerAccountToUser(params);
}

export async function linkCheckoutCustomerAccountToUser(params: {
  userId: string;
  customerAccountId: string;
  phoneE164: string;
}): Promise<LinkCheckoutPhoneResult> {
  const userId = params.userId.trim();
  const customerAccountId = params.customerAccountId.trim();
  const phoneE164 = params.phoneE164.trim();

  if (!userId || !customerAccountId || !phoneE164) {
    return { ok: false, code: "LINK_FAILED", error: "Could not link phone to account." };
  }

  const account = await prisma.customerAccount.findUnique({
    where: { id: customerAccountId },
    select: { id: true, phoneE164: true, userId: true, phoneVerifiedAt: true },
  });

  if (!account || !account.phoneVerifiedAt) {
    return { ok: false, code: "ACCOUNT_NOT_FOUND", error: "Could not link phone to account." };
  }

  if (account.phoneE164 !== phoneE164) {
    return { ok: false, code: "SESSION_MISMATCH", error: "Could not link phone to account." };
  }

  if (account.userId && account.userId !== userId) {
    return {
      ok: false,
      code: "ALREADY_LINKED_OTHER",
      error: "This phone is already linked to another account.",
    };
  }

  const userExisting = await prisma.customerAccount.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (userExisting && userExisting.id !== customerAccountId) {
    return {
      ok: false,
      code: "USER_HAS_OTHER_PHONE",
      error: "Your account already has a different phone linked.",
    };
  }

  const alreadyLinked = account.userId === userId;

  if (!alreadyLinked) {
    const updated = await prisma.customerAccount.updateMany({
      where: { id: customerAccountId, userId: null },
      data: { userId },
    });

    if (updated.count === 0) {
      const refreshed = await prisma.customerAccount.findUnique({
        where: { id: customerAccountId },
        select: { userId: true },
      });
      if (refreshed?.userId === userId) {
        // Concurrent link to same user — treat as success.
      } else if (refreshed?.userId) {
        return {
          ok: false,
          code: "ALREADY_LINKED_OTHER",
          error: "This phone is already linked to another account.",
        };
      } else {
        return { ok: false, code: "LINK_FAILED", error: "Could not link phone to account." };
      }
    }
  }

  const legacyOrdersAttached = await attachLegacyOrdersToCustomerAccount(
    customerAccountId,
    account.phoneE164
  );

  return { ok: true, legacyOrdersAttached, alreadyLinked };
}
