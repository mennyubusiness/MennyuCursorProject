"use server";

import { cookies } from "next/headers";
import { assertCustomerOrderAccess, persistCustomerOrderAccessCookies } from "@/lib/customer-order-access";
import { getOrderWithUnifiedStatus } from "@/services/order-status.service";
import { getOrdersByCustomerPhone } from "@/services/order.service";
import { reorderFromOrder } from "@/services/reorder.service";
import { reconcilePaymentFromRedirect } from "@/services/payment.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";

export async function getOrderStatusAction(orderId: string) {
  const access = await assertCustomerOrderAccess(orderId);
  if (!access.ok) return null;
  return getOrderWithUnifiedStatus(orderId);
}

export async function persistCustomerOrderAccessAction(orderId: string, accessToken: string) {
  return persistCustomerOrderAccessCookies(orderId, accessToken);
}

export async function reconcilePaymentIfSucceededAction(orderId: string) {
  const access = await assertCustomerOrderAccess(orderId);
  if (!access.ok) {
    return { reconciled: false, error: access.error };
  }
  return reconcilePaymentFromRedirect(orderId);
}

/**
 * Post-payment wait screen: retry redirect reconcile (idempotent) then read unified order state.
 */
export async function pollOrderAfterPaymentAction(orderId: string) {
  const access = await assertCustomerOrderAccess(orderId);
  if (!access.ok) {
    throw new Error(access.error);
  }
  const reconcileResult = await reconcilePaymentFromRedirect(orderId);
  const order = await getOrderWithUnifiedStatus(orderId);
  return { reconcileResult, order };
}

/**
 * Clear checkout cart snapshot and drop mennyu_checkout cookie after successful payment redirect.
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
  const sessionId = await getMennyuSessionIdForRequest();
  if (!sessionId) {
    return { success: false as const, error: "Session required. Please try again.", code: "NO_SESSION" };
  }
  return reorderFromOrder(orderId, sessionId);
}
