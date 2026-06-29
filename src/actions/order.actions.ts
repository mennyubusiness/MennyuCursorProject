"use server";

import { auth } from "@/auth";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { userCanAccessOrder } from "@/lib/user-order-access";
import {
  getHostParticipantIdForGroupSession,
} from "@/lib/group-participant-order-access";
import { filterOrderForGroupParticipantView } from "@/lib/group-participant-order-view";
import { prisma } from "@/lib/db";
import { getOrderWithUnifiedStatus } from "@/services/order-status.service";
import { getOrdersForSignedInUser } from "@/services/customer-account-orders.service";
import { reorderFromOrder } from "@/services/reorder.service";
import { reconcilePaymentFromRedirect } from "@/services/payment.service";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";

export async function getOrderStatusAction(orderId: string) {
  const access = await assertCustomerOrderAccess(orderId);
  if (!access.ok) return null;
  const order = await getOrderWithUnifiedStatus(orderId);
  if (!order || access.viewerRole !== "participant" || !access.groupParticipantId) {
    return order;
  }
  const hostParticipantId = order.groupOrderSessionId
    ? await getHostParticipantIdForGroupSession(order.groupOrderSessionId)
    : null;
  return filterOrderForGroupParticipantView(order, access.groupParticipantId, hostParticipantId);
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

export type OrdersForSignedInUserResult =
  | { ok: true; orders: Awaited<ReturnType<typeof getOrdersForSignedInUser>> }
  | { ok: false; error: string };

/** Order history for signed-in User only. */
export async function getOrdersForSignedInUserAction(): Promise<OrdersForSignedInUserResult> {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId || !userEmail) {
    return { ok: false, error: "Sign in to view your order history." };
  }

  const orders = await getOrdersForSignedInUser(userId, userEmail);
  return { ok: true, orders };
}

export async function reorderFromOrderAction(
  orderId: string,
  accessToken?: string | null
) {
  const session = await auth();
  const userId = session?.user?.id;
  const userEmail = session?.user?.email;
  if (!userId || !userEmail) {
    return {
      success: false as const,
      error: "Sign in to reorder from your order history.",
      code: "SIGN_IN_REQUIRED",
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerAccountId: true, customerEmail: true },
  });
  if (!order || !(await userCanAccessOrder(userId, userEmail, order))) {
    return {
      success: false as const,
      error: "You don't have access to reorder this order.",
      code: "ACCESS_DENIED",
    };
  }

  const access = await assertCustomerOrderAccess(orderId, undefined, accessToken ?? null);
  if (!access.ok) {
    return {
      success: false as const,
      error: "You don't have access to reorder this order.",
      code: "ACCESS_DENIED",
    };
  }

  const sessionId = await getMennyuSessionIdForRequest();
  if (!sessionId) {
    return { success: false as const, error: "Session required. Please try again.", code: "NO_SESSION" };
  }

  const result = await reorderFromOrder(orderId, sessionId);
  if (!result.success) {
    return {
      success: false as const,
      error: "You don't have access to reorder this order.",
      code: "ACCESS_DENIED",
    };
  }
  return result;
}

