import "server-only";

import { env } from "@/lib/env";
import {
  buildEmailVerificationUrl,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  EMAIL_VERIFICATION_TTL_MS,
  emailVerificationTokenHashPrefix,
  generateEmailVerificationToken,
  hashEmailVerificationToken,
  normalizeEmailVerificationTokenFromRequest,
} from "@/lib/auth/email-verification-token";
import { isUserEmailVerified } from "@/lib/auth/email-verification-status";
import { getPublicSiteOriginFromEnv } from "@/lib/public-site-url";
import { prisma } from "@/lib/db";
import { sendTransactionalEmail } from "@/lib/email/email.service";
import { ADMIN_AUDIT_ACTION, ADMIN_AUDIT_TARGET } from "@/lib/admin-audit-log";
import { createAdminAuditLog } from "@/services/admin-audit-log.service";
import { sanitizeLoginReturnPath } from "@/lib/auth/login-return-path";
import { isOwnershipClaimPath } from "@/lib/auth/ownership-claim-path";

export const EMAIL_VERIFICATION_SENT_MESSAGE =
  "Verification email sent. Check your inbox for the link.";

export const EMAIL_ALREADY_VERIFIED_MESSAGE = "Email already verified.";

export const EMAIL_VERIFICATION_COOLDOWN_MESSAGE =
  "Please wait a minute before requesting another verification email.";

export const EMAIL_VERIFICATION_INVALID_MESSAGE =
  "This verification link is invalid or expired.";

export const EMAIL_VERIFICATION_EXPIRED_MESSAGE = "This verification link has expired.";

export const EMAIL_VERIFICATION_USED_MESSAGE =
  "This verification link has already been used.";

export const EMAIL_VERIFICATION_SUCCESS_MESSAGE = "Your email address is verified.";

export type SendEmailVerificationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export type VerifyEmailTokenResult =
  | { ok: true; status: "verified" | "already_verified"; message: string; returnPath?: string }
  | { ok: false; status: "invalid" | "expired" | "used"; message: string };

export type EmailVerificationInitiator = "signup" | "user" | "admin";

function resolveVerificationLinkOrigin(requestOrigin?: string): string {
  const fromEnv = getPublicSiteOriginFromEnv();
  if (process.env.PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim()) {
    return fromEnv.replace(/\/$/, "");
  }
  return (requestOrigin ?? fromEnv).replace(/\/$/, "");
}

function buildVerificationEmailBody(verifyUrl: string): { text: string; html: string } {
  const expiryHours = EMAIL_VERIFICATION_TTL_MS / (60 * 60 * 1000);
  const text = [
    "Verify your Open Order email",
    "",
    "Confirm this email address for your Open Order account. This helps protect your account and ensures important order and account messages reach you.",
    "",
    verifyUrl,
    "",
    `This link expires in ${expiryHours} hours.`,
    "",
    "If you didn't create an Open Order account, you can ignore this email.",
  ].join("\n");

  const html = [
    "<p>Verify your Open Order email</p>",
    "<p>Confirm this email address for your Open Order account. This helps protect your account and ensures important order and account messages reach you.</p>",
    `<p><a href="${verifyUrl}">Verify email address</a></p>`,
    `<p>This link expires in ${expiryHours} hours.</p>`,
    "<p>If you didn't create an Open Order account, you can ignore this email.</p>",
  ].join("");

  return { text, html };
}

function logVerificationReject(
  reason: "missing" | "not_found" | "expired" | "consumed" | "email_mismatch",
  tokenHashPrefix: string
): void {
  console.info("[email-verification] verify rejected", { reason, tokenHashPrefix });
}

export async function sendEmailVerificationEmail(input: {
  userId: string;
  requestOrigin?: string;
  initiator?: EmailVerificationInitiator;
  adminUserId?: string | null;
  adminReason?: string;
  returnPath?: string | null;
}): Promise<SendEmailVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerificationLastSentAt: true,
      disabledAt: true,
    },
  });

  if (!user) return { ok: false, error: "User not found." };
  if (user.disabledAt) return { ok: false, error: "This account is disabled." };
  if (isUserEmailVerified(user.emailVerified)) {
    return { ok: false, error: EMAIL_ALREADY_VERIFIED_MESSAGE };
  }

  const cooldownSince = new Date(Date.now() - EMAIL_VERIFICATION_RESEND_COOLDOWN_MS);
  if (user.emailVerificationLastSentAt && user.emailVerificationLastSentAt >= cooldownSince) {
    return { ok: false, error: EMAIL_VERIFICATION_COOLDOWN_MESSAGE };
  }

  const rawToken = generateEmailVerificationToken();
  const tokenHash = hashEmailVerificationToken(rawToken);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
  const now = new Date();
  const safeReturnPath = sanitizeLoginReturnPath(input.returnPath);
  const claimReturnPath = isOwnershipClaimPath(safeReturnPath) ? safeReturnPath : null;

  await prisma.$transaction([
    prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
    }),
    prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        email: user.email,
        expiresAt,
        sentAt: null,
        metadata: claimReturnPath ? { returnPath: claimReturnPath } : undefined,
      },
    }),
  ]);

  const siteOrigin = resolveVerificationLinkOrigin(input.requestOrigin);
  const verifyUrl = buildEmailVerificationUrl(siteOrigin, rawToken, claimReturnPath);
  const { text, html } = buildVerificationEmailBody(verifyUrl);

  const emailResult = await sendTransactionalEmail({
    to: user.email,
    subject: "Verify your Open Order email",
    text,
    html,
    eventType: "email_verification",
  });

  if (emailResult.status === "failed") {
    await prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id, tokenHash, usedAt: null },
    });
    return {
      ok: false,
      error: emailResult.failureMessage ?? "Could not send verification email.",
    };
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { tokenHash },
      data: { sentAt: now },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerificationLastSentAt: now },
    }),
  ]);

  if (env.NODE_ENV === "development") {
    console.info("[email-verification] dev verify url", verifyUrl);
  }

  if (input.initiator === "admin" && input.adminReason) {
    await createAdminAuditLog({
      adminUserId: input.adminUserId ?? null,
      actionType: ADMIN_AUDIT_ACTION.EMAIL_VERIFICATION_SENT,
      targetType: ADMIN_AUDIT_TARGET.user,
      targetId: user.id,
      reason: input.adminReason,
      metadata: { email: user.email },
    });
  }

  return { ok: true, message: EMAIL_VERIFICATION_SENT_MESSAGE };
}

export async function verifyEmailWithToken(tokenRaw: string): Promise<VerifyEmailTokenResult> {
  const token = normalizeEmailVerificationTokenFromRequest(tokenRaw);
  if (!token) {
    logVerificationReject("missing", "none");
    return { ok: false, status: "invalid", message: EMAIL_VERIFICATION_INVALID_MESSAGE };
  }

  const tokenHash = hashEmailVerificationToken(token);
  const tokenHashPrefix = emailVerificationTokenHashPrefix(token);

  const row = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      email: true,
      expiresAt: true,
      usedAt: true,
      metadata: true,
      user: { select: { email: true, emailVerified: true } },
    },
  });

  if (!row) {
    logVerificationReject("not_found", tokenHashPrefix);
    return { ok: false, status: "invalid", message: EMAIL_VERIFICATION_INVALID_MESSAGE };
  }

  if (isUserEmailVerified(row.user.emailVerified)) {
    return {
      ok: true,
      status: "already_verified",
      message: EMAIL_VERIFICATION_SUCCESS_MESSAGE,
      returnPath: verificationReturnPath(row.metadata),
    };
  }

  if (row.usedAt) {
    logVerificationReject("consumed", tokenHashPrefix);
    return { ok: false, status: "used", message: EMAIL_VERIFICATION_USED_MESSAGE };
  }

  if (row.expiresAt <= new Date()) {
    logVerificationReject("expired", tokenHashPrefix);
    return { ok: false, status: "expired", message: EMAIL_VERIFICATION_EXPIRED_MESSAGE };
  }

  if (row.email.toLowerCase() !== row.user.email.toLowerCase()) {
    logVerificationReject("email_mismatch", tokenHashPrefix);
    return { ok: false, status: "invalid", message: EMAIL_VERIFICATION_INVALID_MESSAGE };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { emailVerified: now },
    }),
    prisma.emailVerificationToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
    prisma.emailVerificationToken.updateMany({
      where: {
        userId: row.userId,
        usedAt: null,
        id: { not: row.id },
      },
      data: { usedAt: now },
    }),
  ]);

  return {
    ok: true,
    status: "verified",
    message: EMAIL_VERIFICATION_SUCCESS_MESSAGE,
    returnPath: verificationReturnPath(row.metadata),
  };
}

function verificationReturnPath(metadata: unknown): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const value = (metadata as { returnPath?: unknown }).returnPath;
  if (typeof value !== "string") return undefined;
  const safe = sanitizeLoginReturnPath(value);
  return isOwnershipClaimPath(safe) ? safe ?? undefined : undefined;
}

export async function revokeEmailVerificationTokens(input: {
  userId: string;
  adminUserId: string | null;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true },
  });
  if (!user) return { ok: false, error: "User not found." };

  const now = new Date();
  const result = await prisma.emailVerificationToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: now },
  });

  if (result.count > 0) {
    await createAdminAuditLog({
      adminUserId: input.adminUserId,
      actionType: ADMIN_AUDIT_ACTION.EMAIL_VERIFICATION_TOKEN_REVOKED,
      targetType: ADMIN_AUDIT_TARGET.user,
      targetId: user.id,
      reason: input.reason,
      metadata: { revokedCount: result.count },
    });
  }

  return { ok: true };
}
