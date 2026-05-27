import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";

export type CustomerOrderAccessResult =
  | { ok: true; orderId: string; customerPhone: string }
  | { ok: false; status: 401 | 403 | 404; error: string };

/**
 * Validates that the current request has the same customer phone as the order.
 * Matches cancel routes — cookie/header phone, not session user id.
 */
export async function assertCustomerOrderAccess(
  orderId: string,
  headersList?: Headers
): Promise<CustomerOrderAccessResult> {
  const h = headersList ?? (await headers());
  const customerPhone = getCustomerPhoneFromHeaders(h);
  if (!customerPhone?.trim()) {
    return {
      ok: false,
      status: 401,
      error: "Customer identity required. Please use the same device you used to place the order.",
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerPhone: true },
  });
  if (!order) {
    return { ok: false, status: 404, error: "Order not found" };
  }
  if (order.customerPhone !== customerPhone.trim()) {
    return { ok: false, status: 403, error: "This order does not belong to you." };
  }

  return { ok: true, orderId: order.id, customerPhone: customerPhone.trim() };
}
