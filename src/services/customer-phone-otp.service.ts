import "server-only";

import { randomInt } from "crypto";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { normalizePhoneToE164US } from "@/lib/phone-e164";
import { prisma } from "@/lib/db";
import { createCustomerSessionRecord } from "@/lib/customer-session";
import { sendTransactionalSms } from "@/services/sms.service";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_VERIFY_ATTEMPTS = 5;
/** Minimum spacing between send-code requests for the same phone. */
const SEND_COOLDOWN_MS = 60 * 1000;
// TODO: add shared IP/device rate limiting for send-code across phones.

export type SendPhoneCodeResult =
  | { ok: true; message: string }
  | { ok: false; status: number; error: string };

export type VerifyPhoneCodeResult =
  | {
      ok: true;
      customerAccountId: string;
      phoneE164: string;
      sessionToken: string;
    }
  | { ok: false; status: number; error: string };

function genericSendSuccessMessage(): string {
  return "If this number can receive texts, we sent a verification code.";
}

export async function sendPhoneVerificationCode(phoneRaw: string): Promise<SendPhoneCodeResult> {
  const normalized = normalizePhoneToE164US(phoneRaw);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }
  const phoneE164 = normalized.e164;

  const recent = await prisma.customerPhoneVerification.findFirst({
    where: {
      phoneE164,
      createdAt: { gte: new Date(Date.now() - SEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return { ok: true, message: genericSendSuccessMessage() };
  }

  const code = String(randomInt(100000, 1000000));
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.customerPhoneVerification.create({
    data: {
      phoneE164,
      codeHash,
      expiresAt,
    },
  });

  const body = `Your Open Order verification code is ${code}. It expires in 10 minutes.`;
  await sendTransactionalSms({
    to: phoneE164,
    body,
    eventType: "customer_phone_otp",
  });

  return { ok: true, message: genericSendSuccessMessage() };
}

export async function verifyPhoneVerificationCode(
  phoneRaw: string,
  codeRaw: string
): Promise<VerifyPhoneCodeResult> {
  const normalized = normalizePhoneToE164US(phoneRaw);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }
  const phoneE164 = normalized.e164;

  const code = codeRaw.trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, status: 400, error: "Enter the 6-digit code we texted you." };
  }

  const verification = await prisma.customerPhoneVerification.findFirst({
    where: {
      phoneE164,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!verification) {
    return { ok: false, status: 400, error: "Code expired or not found. Request a new code." };
  }

  if (verification.attemptCount >= MAX_VERIFY_ATTEMPTS) {
    return { ok: false, status: 429, error: "Too many attempts. Request a new code." };
  }

  const codeMatches = await verifyPassword(code, verification.codeHash);
  if (!codeMatches) {
    await prisma.customerPhoneVerification.update({
      where: { id: verification.id },
      data: { attemptCount: { increment: 1 } },
    });
    const attemptsLeft = MAX_VERIFY_ATTEMPTS - verification.attemptCount - 1;
    if (attemptsLeft <= 0) {
      return { ok: false, status: 429, error: "Too many attempts. Request a new code." };
    }
    return { ok: false, status: 400, error: "Incorrect code. Try again." };
  }

  const now = new Date();

  const account = await prisma.$transaction(async (tx) => {
    await tx.customerPhoneVerification.update({
      where: { id: verification.id },
      data: { consumedAt: now },
    });

    return tx.customerAccount.upsert({
      where: { phoneE164 },
      create: {
        phoneE164,
        phoneVerifiedAt: now,
      },
      update: {
        phoneVerifiedAt: now,
      },
    });
  });

  const { token: sessionToken } = await createCustomerSessionRecord(account.id);

  return {
    ok: true,
    customerAccountId: account.id,
    phoneE164: account.phoneE164,
    sessionToken,
  };
}

/** Test helper: expose OTP TTL for assertions. */
export const CUSTOMER_PHONE_OTP_TTL_MS = OTP_TTL_MS;
export const CUSTOMER_PHONE_OTP_MAX_ATTEMPTS = MAX_VERIFY_ATTEMPTS;
