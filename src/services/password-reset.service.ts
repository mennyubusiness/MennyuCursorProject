import "server-only";

import {
  PASSWORD_RESET_GENERIC_FAILURE_MESSAGE,
  PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "@/lib/auth/password-reset-messages";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  normalizeAccountEmail,
  validateAccountPassword,
} from "@/lib/auth/password-policy";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/auth/password-reset-token";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/email.service";

export {
  PASSWORD_RESET_GENERIC_FAILURE_MESSAGE,
  PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "@/lib/auth/password-reset-messages";

const RESET_EXPIRY_MINUTES = PASSWORD_RESET_TTL_MS / (60 * 1000);

export type RequestPasswordResetResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type ResetPasswordResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

function buildResetEmailBody(resetUrl: string): { text: string; html: string } {
  const text = [
    "Reset your Open Order password",
    "",
    `Use this link to choose a new password (expires in ${RESET_EXPIRY_MINUTES} minutes):`,
    resetUrl,
    "",
    "If you didn't request this, you can ignore this email.",
  ].join("\n");

  const html = [
    "<p>Reset your Open Order password</p>",
    `<p><a href="${resetUrl}">Reset your password</a></p>`,
    `<p>This link expires in ${RESET_EXPIRY_MINUTES} minutes.</p>`,
    "<p>If you didn't request this, you can ignore this email.</p>",
  ].join("");

  return { text, html };
}

export async function requestPasswordReset(
  emailRaw: string,
  origin?: string
): Promise<RequestPasswordResetResult> {
  const email = normalizeAccountEmail(emailRaw);
  if (!email.includes("@")) {
    return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
  }

  const rawToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const siteOrigin = (origin ?? getPublicSiteOriginFromEnv()).replace(/\/$/, "");
  const resetUrl = `${siteOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const { text, html } = buildResetEmailBody(resetUrl);

  await sendTransactionalEmail({
    to: user.email,
    subject: "Reset your Open Order password",
    text,
    html,
    eventType: "password_reset",
  });

  return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
}

export async function resetPasswordWithToken(
  tokenRaw: string,
  newPassword: string
): Promise<ResetPasswordResult> {
  const token = tokenRaw.trim();
  if (!token) {
    return { ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE };
  }

  const passwordError = validateAccountPassword(newPassword);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const tokenHash = hashPasswordResetToken(token);
  const resetRow = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      consumedAt: true,
      user: { select: { passwordHash: true } },
    },
  });

  if (!resetRow || resetRow.consumedAt || resetRow.expiresAt <= new Date()) {
    return { ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE };
  }

  const passwordHash = await hashPassword(newPassword);
  const now = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetRow.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRow.id },
      data: { consumedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: {
        userId: resetRow.userId,
        consumedAt: null,
        id: { not: resetRow.id },
      },
      data: { consumedAt: now },
    }),
  ]);

  return { ok: true, message: PASSWORD_RESET_SUCCESS_MESSAGE };
}

/** Test helper: verify old password no longer matches after reset. */
export async function verifyUserPassword(userId: string, plain: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) return false;
  return verifyPassword(plain, user.passwordHash);
}
