import "server-only";

import { createHash, randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const CUSTOMER_SESSION_COOKIE = "mennyu_customer";
export const CUSTOMER_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

export function hashCustomerSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function getCustomerSessionTokenFromHeaders(headers: Headers): string | null {
  const cookieHeader = headers.get("cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${CUSTOMER_SESSION_COOKIE}=([^;]+)`));
  const value = match?.[1]?.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function getCustomerSessionTokenFromRequest(request: NextRequest): string | null {
  const fromCookie = request.cookies.get(CUSTOMER_SESSION_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie;
  return getCustomerSessionTokenFromHeaders(request.headers);
}

export type CustomerSessionInfo = {
  customerAccountId: string;
  phoneE164: string;
  sessionId: string;
};

export async function getCustomerSessionFromRequest(
  headersOrRequest?: Headers | NextRequest
): Promise<CustomerSessionInfo | null> {
  let token: string | null = null;
  if (headersOrRequest instanceof Request || (headersOrRequest && "cookies" in headersOrRequest)) {
    token = getCustomerSessionTokenFromRequest(headersOrRequest as NextRequest);
  } else if (headersOrRequest) {
    token = getCustomerSessionTokenFromHeaders(headersOrRequest);
  }

  if (!token) return null;

  const tokenHash = hashCustomerSessionToken(token);
  const now = new Date();

  const row = await prisma.customerSession.findUnique({
    where: { tokenHash },
    include: { customerAccount: { select: { id: true, phoneE164: true } } },
  });

  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt <= now) return null;

  await prisma.customerSession
    .update({
      where: { id: row.id },
      data: { lastSeenAt: now },
    })
    .catch(() => undefined);

  return {
    customerAccountId: row.customerAccount.id,
    phoneE164: row.customerAccount.phoneE164,
    sessionId: row.id,
  };
}

export type AssertCustomerSessionResult =
  | { ok: true; customerAccountId: string; phoneE164: string }
  | { ok: false; status: 401; error: string };

export async function assertCustomerSession(
  headersOrRequest?: Headers | NextRequest
): Promise<AssertCustomerSessionResult> {
  const session = await getCustomerSessionFromRequest(headersOrRequest);
  if (!session) {
    return { ok: false, status: 401, error: "Verify your phone before checkout." };
  }
  return {
    ok: true,
    customerAccountId: session.customerAccountId,
    phoneE164: session.phoneE164,
  };
}

export async function createCustomerSessionRecord(
  customerAccountId: string
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashCustomerSessionToken(token);
  const expiresAt = new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE_SEC * 1000);

  await prisma.customerSession.create({
    data: {
      customerAccountId,
      tokenHash,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export function buildCustomerSessionCookieHeader(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${CUSTOMER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${CUSTOMER_SESSION_MAX_AGE_SEC}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export function buildClearCustomerSessionCookieHeader(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [
    `${CUSTOMER_SESSION_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

/** Revoke a customer session token if present. Idempotent — missing/stale/revoked rows are OK. */
export async function revokeCustomerSessionToken(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    const tokenHash = hashCustomerSessionToken(token);
    await prisma.customerSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    console.error("[customer-session] Failed to revoke session", error);
  }
}

/** Revoke the current mennyu_customer session row, if present. */
export async function revokeCustomerSessionFromHeaders(headers: Headers): Promise<void> {
  await revokeCustomerSessionToken(getCustomerSessionTokenFromHeaders(headers));
}

/** Revoke session from a NextRequest (cookie jar or Cookie header). */
export async function revokeCustomerSessionFromRequest(request: NextRequest): Promise<void> {
  await revokeCustomerSessionToken(getCustomerSessionTokenFromRequest(request));
}
