"use server";

import { headers, cookies } from "next/headers";
import { getOrderWithUnifiedStatus } from "@/services/order-status.service";
import { getOrdersByCustomerPhone } from "@/services/order.service";
import { reorderFromOrder } from "@/services/reorder.service";
import { reconcilePaymentFromRedirect } from "@/services/payment.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { getSessionIdFromHeaders } from "@/lib/session";

export async function getOrderStatusAction(orderId: string) {
  return getOrderWithUnifiedStatus(orderId);
}

export async function reconcilePaymentIfSucceededAction(orderId: string) {
  return reconcilePaymentFromRedirect(orderId);
}

/**
 * Clear checkout cart snapshot and drop mennyu_checkout cookie after successful payment redirect.
 * Uses Order.sourceCartId (no fragile cookie cart id required).
 */
export async function clearCartAfterOrderSuccessAction(orderId: string) {
  await clearCheckoutSourceCartForOrder(orderId);
  const cookieStore = await cookies();
  cookieStore.delete("mennyu_checkout");
}

export async function getOrdersByCustomerPhoneAction(customerPhone: string) {
  return getOrdersByCustomerPhone(customerPhone);
}

export async function reorderFromOrderAction(orderId: string) {
  const h = await headers();
  const sessionId = getSessionIdFromHeaders(h);
  if (!sessionId) {
    return { success: false as const, error: "Session required. Please try again.", code: "NO_SESSION" };
  }
  return reorderFromOrder(orderId, sessionId);
}
