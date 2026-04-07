"use server";

import { hashPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

const MIN_PASSWORD = 8;

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string };

export async function registerWithEmailPassword(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<RegisterResult> {
  const email = input.email.toLowerCase().trim();
  const password = input.password;
  if (!email.includes("@")) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` };
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
