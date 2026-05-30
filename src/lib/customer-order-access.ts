import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getCustomerSessionFromRequest } from "@/lib/customer-session";
import { userCanAccessOrder } from "@/lib/user-order-access";
import { verifyCustomerOrderAccessToken } from "@/lib/customer-order-access-token";
import {
  CUSTOMER_PHONE_COOKIE,
  getCustomerOrderAccessTokenFromHeaders,
  getCustomerPhoneFromHeaders,
  MENNYU_SESSION_MAX_AGE,
  ORDER_ACCESS_COOKIE,
  buildCustomerPhoneCookieHeader,
  buildOrderAccessCookieHeader,
} from "@/lib/session";

export type CustomerOrderAccessResult =
  | { ok: true; orderId: string; customerPhone: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

function resolveAccessToken(
  headersList: Headers,
  explicitToken?: string | null
): string | null {
  const fromParam = explicitToken?.trim();
  if (fromParam) return fromParam;
  return getCustomerOrderAccessTokenFromHeaders(headersList);
}

/**
 * Validates customer access to an order via signed access token, verified customer session,
 * or legacy phone cookie (migration fallback).
 */
export async function assertCustomerOrderAccess(
  orderId: string,
  headersList?: Headers,
  accessToken?: string | null
): Promise<CustomerOrderAccessResult> {
  const h = headersList ?? (await headers());
  const token = resolveAccessToken(h, accessToken);
  const customerPhone = getCustomerPhoneFromHeaders(h)?.trim() ?? "";

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerPhone: true, customerAccountId: true, customerEmail: true },
  });
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const orderPhone = order.customerPhone.trim();

  if (token && verifyCustomerOrderAccessToken(orderId, token)) {
    return { ok: true, orderId: order.id, customerPhone: orderPhone };
  }

  const session = await auth();
  if (
    session?.user?.id &&
    (await userCanAccessOrder(session.user.id, session.user.email, order))
  ) {
    return { ok: true, orderId: order.id, customerPhone: orderPhone };
  }

  const customerSession = await getCustomerSessionFromRequest(h);
  if (
    customerSession &&
    order.customerAccountId &&
    customerSession.customerAccountId === order.customerAccountId
  ) {
    return { ok: true, orderId: order.id, customerPhone: orderPhone };
  }

  // Legacy migration fallback: mennyu_customer_phone cookie (forgeable — not used for /orders history).
  // Remaining uses: orders placed before CustomerAccount, SMS bootstrap cookie, cancel APIs (Phase 3+).
  if (!customerPhone) {
    return {
      ok: false,
      status: 401,
      error: "Customer identity required. Open the link from your order confirmation or sign in to view your order history.",
    };
  }

  if (customerPhone !== orderPhone) {
    return { ok: false, status: 403, error: "This order does not belong to you." };
  }

  return { ok: true, orderId: order.id, customerPhone: orderPhone };
}

export type CustomerOrderAccessBootstrapResult = CustomerOrderAccessResult;

/**
 * Validates a signed access link before persisting cookies (route handler or server action).
 */
export async function resolveCustomerOrderAccessBootstrap(
  orderId: string,
  accessToken: string
): Promise<CustomerOrderAccessBootstrapResult> {
  if (!verifyCustomerOrderAccessToken(orderId, accessToken)) {
    return { ok: false, status: 403, error: "Invalid or expired order access link." };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerPhone: true },
  });
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  return { ok: true, orderId: order.id, customerPhone: order.customerPhone.trim() };
}

/** HttpOnly Set-Cookie header values for order access bootstrap (route handlers only). */
export function buildPersistedCustomerOrderAccessCookieHeaders(
  accessToken: string,
  customerPhone: string
): string[] {
  return [
    buildCustomerPhoneCookieHeader(customerPhone.trim(), { httpOnly: true }),
    buildOrderAccessCookieHeader(accessToken),
  ];
}

/**
 * After a valid signed access link, persist HttpOnly phone + access cookies for polling/refresh.
 * Use only from Server Actions — not from Server Component render. Prefer the access bootstrap route.
 */
export async function persistCustomerOrderAccessCookies(
  orderId: string,
  accessToken: string
): Promise<CustomerOrderAccessResult> {
  const resolved = await resolveCustomerOrderAccessBootstrap(orderId, accessToken);
  if (!resolved.ok) return resolved;

  const isProd = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PHONE_COOKIE, resolved.customerPhone, {
    path: "/",
    maxAge: MENNYU_SESSION_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });
  cookieStore.set(ORDER_ACCESS_COOKIE, accessToken, {
    path: "/",
    maxAge: MENNYU_SESSION_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: isProd,
  });

  return resolved;
}
