"use server";

import { cookies } from "next/headers";
import { getOrderWithUnifiedStatus } from "@/services/order-status.service";
import { getOrdersByCustomerPhone } from "@/services/order.service";
import { reorderFromOrder } from "@/services/reorder.service";
import { reconcilePaymentFromRedirect } from "@/services/payment.service";
import { clearCheckoutSourceCartForOrder } from "@/services/cart.service";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";

export async function getOrderStatusAction(orderId: string) {
  return getOrderWithUnifiedStatus(orderId);
}

export async function reconcilePaymentIfSucceededAction(orderId: string) {
  return reconcilePaymentFromRedirect(orderId);
}

/**
 * Post-payment wait screen: retry redirect reconcile (idempotent) then read unified order state.
 * Matches what a full page refresh does (server runs reconcile again); read-only polling alone
 * does not, so it could stay stuck on pending_payment while refresh fixes the order.
 */
export async function pollOrderAfterPaymentAction(orderId: string) {
  const reconcileResult = await reconcilePaymentFromRedirect(orderId);
  const order = await getOrderWithUnifiedStatus(orderId);
  // TEMP DEBUG: remove after post-payment flow verification
  console.info("[mennyu:post-payment-debug] pollOrderAfterPaymentAction", {
    orderId,
    reconciled: reconcileResult.reconciled,
    reconcileError: reconcileResult.error,
    orderStatus: order?.status,
    derivedStatus: order?.derivedStatus,
  });
  return { reconcileResult, order };
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
  const sessionId = await getMennyuSessionIdForRequest();
  if (!sessionId) {
    return { success: false as const, error: "Session required. Please try again.", code: "NO_SESSION" };
  }
  return reorderFromOrder(orderId, sessionId);
}
