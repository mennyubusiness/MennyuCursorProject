"use server";

import { headers } from "next/headers";
import { hashPassword } from "@/lib/auth/password";
import {
  normalizeAccountEmail,
  validateAccountEmail,
  validateAccountPassword,
} from "@/lib/auth/password-policy";
import { prisma } from "@/lib/db";
import {
  RATE_LIMITS,
  RATE_LIMIT_ERROR_MESSAGE,
  enforceRateLimits,
  rateLimitKeys,
} from "@/lib/rate-limit";
import { getClientIpFromHeaders } from "@/lib/rate-limit-http";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerWithEmailPassword(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResult> {
  const headersList = await headers();
  const limited = enforceRateLimits([
    {
      key: rateLimitKeys.registerIp(getClientIpFromHeaders(headersList)),
      ...RATE_LIMITS.registerIp,
    },
  ]);
  if (limited) {
    return { ok: false, error: RATE_LIMIT_ERROR_MESSAGE };
  }

  const email = normalizeAccountEmail(input.email);
  const password = input.password;
  const emailError = validateAccountEmail(email);
  if (emailError) {
    return { ok: false, error: emailError };
  }
  const passwordError = validateAccountPassword(password);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists. Sign in instead." };
  }

  const passwordHash = await hashPassword(password);
  const name = input.name?.trim() || null;

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      needsAccountRoleSelection: true,
    },
  });

  return { ok: true };
}
