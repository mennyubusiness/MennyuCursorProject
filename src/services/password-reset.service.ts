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
  buildPasswordResetUrl,
  generatePasswordResetToken,
  hashPasswordResetToken,
  normalizePasswordResetTokenFromRequest,
  PASSWORD_RESET_REQUEST_DEDUPE_MS,
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

type ResetRejectReason = "missing" | "not_found" | "expired" | "consumed";

function logPasswordResetReject(reason: ResetRejectReason, tokenHashPrefix: string): void {
  console.info("[password-reset] reset rejected", { reason, tokenHashPrefix });
}

/** Prefer PUBLIC_APP_URL / NEXTAUTH_URL; fall back to request origin in dev when unset. */
export function resolvePasswordResetLinkOrigin(requestOrigin?: string): string {
  const fromEnv = getPublicSiteOriginFromEnv();
  if (process.env.PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return (requestOrigin ?? fromEnv).replace(/\/$/, "");
}

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
  requestOrigin?: string
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

  const dedupeSince = new Date(Date.now() - PASSWORD_RESET_REQUEST_DEDUPE_MS);
  const recentActive = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      createdAt: { gte: dedupeSince },
    },
    select: { id: true },
  });
  if (recentActive) {
    return { ok: true, message: PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE };
  }

  const rawToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const siteOrigin = resolvePasswordResetLinkOrigin(requestOrigin);
  const resetUrl = buildPasswordResetUrl(siteOrigin, rawToken);
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
  const token = normalizePasswordResetTokenFromRequest(tokenRaw);
  if (!token) {
    logPasswordResetReject("missing", "none");
    return { ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE };
  }

  const passwordError = validateAccountPassword(newPassword);
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const tokenHash = hashPasswordResetToken(token);
  const tokenHashPrefix = tokenHash.slice(0, 12);
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

  if (!resetRow) {
    logPasswordResetReject("not_found", tokenHashPrefix);
    return { ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE };
  }
  if (resetRow.consumedAt) {
    logPasswordResetReject("consumed", tokenHashPrefix);
    return { ok: false, error: PASSWORD_RESET_GENERIC_FAILURE_MESSAGE };
  }
  if (resetRow.expiresAt <= new Date()) {
    logPasswordResetReject("expired", tokenHashPrefix);
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
