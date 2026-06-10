import "server-only";

import { prisma } from "@/lib/db";
import {
  assertCustomerSession,
  createCustomerSessionRecord,
  getCustomerSessionFromRequest,
} from "@/lib/customer-session";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import type { NextRequest } from "next/server";

export type UserVerifiedPhoneAccount = {
  customerAccountId: string;
  phoneE164: string;
  phoneVerifiedAt: Date;
};

/** Linked CustomerAccount with a verified phone for a signed-in User. */
export async function getUserLinkedVerifiedPhoneAccount(
  userId: string
): Promise<UserVerifiedPhoneAccount | null> {
  const account = await prisma.customerAccount.findFirst({
    where: { userId },
    select: {
      id: true,
      phoneE164: true,
      phoneVerifiedAt: true,
    },
  });
  if (!account?.phoneVerifiedAt) return null;
  return {
    customerAccountId: account.id,
    phoneE164: account.phoneE164,
    phoneVerifiedAt: account.phoneVerifiedAt,
  };
}

/** True when signed-in user's linked verified phone matches checkout phone (E.164). */
export function isUserPhoneVerifiedForCheckout(
  account: UserVerifiedPhoneAccount | null,
  checkoutPhoneRaw: string
): boolean {
  if (!account?.phoneVerifiedAt) return false;
  const normalized = normalizePhoneToE164US(checkoutPhoneRaw);
  if (!normalized.ok) return false;
  return normalized.e164 === account.phoneE164;
}

export type ResolveCheckoutPhoneVerificationResult =
  | {
      ok: true;
      customerAccountId: string | null;
      phoneE164: string;
      /** Set mennyu_customer cookie on checkout response when bypassing OTP via account. */
      establishCustomerSession?: boolean;
    }
  | { ok: false; status: number; error: string; code: string };

export type ResolveCheckoutPhoneForOrderResult = ResolveCheckoutPhoneVerificationResult;

/**
 * Resolve checkout phone for order placement.
 * SMS verification is required only when the customer opts in to transactional SMS.
 */
export async function resolveCheckoutPhoneForOrder(
  request: NextRequest,
  authUserId: string | null,
  checkoutPhoneRaw: string,
  smsConsent: boolean
): Promise<ResolveCheckoutPhoneForOrderResult> {
  const trimmed = checkoutPhoneRaw.trim();
  if (!trimmed) {
    return { ok: true, phoneE164: "", customerAccountId: null };
  }

  const normalized = normalizePhoneToE164US(trimmed);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      error: normalized.error,
      code: "INVALID_PHONE",
    };
  }

  if (!smsConsent) {
    return {
      ok: true,
      phoneE164: normalized.e164,
      customerAccountId: null,
    };
  }

  return resolveCheckoutPhoneVerification(request, authUserId, trimmed);
}

/**
 * Server-side checkout phone verification (do not trust client flags).
 * Guests and changed phones require a valid CustomerSession from OTP.
 * Signed-in users with a linked verified phone matching checkout may proceed without OTP.
 */
export async function resolveCheckoutPhoneVerification(
  request: NextRequest,
  authUserId: string | null,
  checkoutPhoneRaw: string
): Promise<ResolveCheckoutPhoneVerificationResult> {
  const normalized = normalizePhoneToE164US(checkoutPhoneRaw);
  if (!normalized.ok) {
    return {
      ok: false,
      status: 400,
      error: normalized.error,
      code: "INVALID_PHONE",
    };
  }
  const checkoutE164 = normalized.e164;

  const customerSession = await assertCustomerSession(request);
  if (customerSession.ok) {
    if (customerSession.phoneE164 !== checkoutE164) {
      return {
        ok: false,
        status: 403,
        error: "Phone must match your verified number. Verify your phone again if you changed it.",
        code: "PHONE_MISMATCH",
      };
    }
    return {
      ok: true,
      customerAccountId: customerSession.customerAccountId,
      phoneE164: checkoutE164,
    };
  }

  if (!authUserId) {
    return {
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
      code: "CUSTOMER_SESSION_REQUIRED",
    };
  }

  const linkedAccount = await getUserLinkedVerifiedPhoneAccount(authUserId);
  if (!isUserPhoneVerifiedForCheckout(linkedAccount, checkoutPhoneRaw)) {
    return {
      ok: false,
      status: 401,
      error: "Verify your phone before checkout.",
      code: "CUSTOMER_SESSION_REQUIRED",
    };
  }

  const existingCookie = await getCustomerSessionFromRequest(request);
  const establishCustomerSession =
    !existingCookie || existingCookie.phoneE164 !== checkoutE164;

  return {
    ok: true,
    customerAccountId: linkedAccount!.customerAccountId,
    phoneE164: checkoutE164,
    establishCustomerSession,
  };
}

/** Issue a fresh customer session cookie for account-verified checkout bypass. */
export async function createCustomerSessionCookieForAccount(
  customerAccountId: string
): Promise<string> {
  const { token } = await createCustomerSessionRecord(customerAccountId);
  return token;
}
