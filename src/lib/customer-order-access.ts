import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyCustomerOrderAccessToken } from "@/lib/customer-order-access-token";
import {
  CUSTOMER_PHONE_COOKIE,
  getCustomerOrderAccessTokenFromHeaders,
  getCustomerPhoneFromHeaders,
  MENNYU_SESSION_MAX_AGE,
  ORDER_ACCESS_COOKIE,
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
 * Validates customer access to an order via matching phone cookie or signed access token.
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
    select: { id: true, customerPhone: true },
  });
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }

  const orderPhone = order.customerPhone.trim();

  if (token && verifyCustomerOrderAccessToken(orderId, token)) {
    return { ok: true, orderId: order.id, customerPhone: orderPhone };
  }

  if (!customerPhone) {
    return {
      ok: false,
      status: 401,
      error: "Customer identity required. Open the link from your order confirmation or enter your phone on the orders page.",
    };
  }

  if (customerPhone !== orderPhone) {
    return { ok: false, status: 403, error: "This order does not belong to you." };
  }

  return { ok: true, orderId: order.id, customerPhone: orderPhone };
}

/**
 * After a valid signed access link, persist HttpOnly phone + access cookies for polling/refresh.
 */
export async function persistCustomerOrderAccessCookies(
  orderId: string,
  accessToken: string
): Promise<CustomerOrderAccessResult> {
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

  const isProd = process.env.NODE_ENV === "production";
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_PHONE_COOKIE, order.customerPhone.trim(), {
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

  return { ok: true, orderId: order.id, customerPhone: order.customerPhone.trim() };
}
