"use server";

import { headers } from "next/headers";
import { getOrderWithUnifiedStatus } from "@/services/order-status.service";
import { getOrdersByCustomerPhone } from "@/services/order.service";
import { reorderFromOrder } from "@/services/reorder.service";
import { getSessionIdFromHeaders } from "@/lib/session";

export async function getOrderStatusAction(orderId: string) {
  return getOrderWithUnifiedStatus(orderId);
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
