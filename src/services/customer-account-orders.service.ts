import "server-only";

import { prisma } from "@/lib/db";
import { formatPickupDetailLine } from "@/lib/pickup-display";
import { resolvePickupTimezone } from "@/lib/pickup-scheduling";

export interface OrderHistoryEntry {
  id: string;
  createdAt: Date;
  totalCents: number;
  status: string;
  podName: string;
  vendorNames: string[];
  pickupDisplayLine: string;
}

type OrderHistoryRow = {
  id: string;
  createdAt: Date;
  totalCents: number;
  status: string;
  requestedPickupAt: Date | null;
  deliverectEstimatedReadyAt: Date | null;
  pod: { name: string; pickupTimezone: string | null };
  vendorOrders: Array<{ vendor: { name: string } }>;
};

function mapOrderRowsToHistoryEntries(orders: OrderHistoryRow[]): OrderHistoryEntry[] {
  return orders.map((o) => {
    const tz = resolvePickupTimezone(o.pod);
    return {
      id: o.id,
      createdAt: o.createdAt,
      totalCents: o.totalCents,
      status: o.status,
      podName: o.pod.name,
      vendorNames: [...new Set(o.vendorOrders.map((vo) => vo.vendor.name))],
      pickupDisplayLine: formatPickupDetailLine({
        requestedPickupAt: o.requestedPickupAt,
        deliverectEstimatedReadyAt: o.deliverectEstimatedReadyAt,
        resolvedPickupTimezone: tz,
      }),
    };
  });
}

const orderHistoryInclude = {
  pod: { select: { name: true, pickupTimezone: true } },
  vendorOrders: { include: { vendor: { select: { name: true } } } },
} as const;

/**
 * Attach legacy orders (phone snapshot only) to a verified customer account.
 * Safe when phoneE164 matches immutable Order.customerPhone on pre-account orders.
 */
export async function attachLegacyOrdersToCustomerAccount(
  customerAccountId: string,
  phoneE164: string
): Promise<number> {
  const normalized = phoneE164.trim();
  if (!normalized) return 0;
  const { count } = await prisma.order.updateMany({
    where: {
      customerPhone: normalized,
      customerAccountId: null,
    },
    data: { customerAccountId },
  });
  return count;
}

/** Order history for a signed-in User (linked CustomerAccount and/or matching checkout email). */
export async function getOrdersForSignedInUser(
  userId: string,
  userEmail: string
): Promise<OrderHistoryEntry[]> {
  const linkedAccount = await prisma.customerAccount.findFirst({
    where: { userId },
    select: { id: true, phoneE164: true },
  });

  if (linkedAccount) {
    await attachLegacyOrdersToCustomerAccount(linkedAccount.id, linkedAccount.phoneE164);
  }

  const normalizedEmail = userEmail.toLowerCase().trim();
  const orConditions: Array<{ customerAccountId?: string; customerEmail?: string }> = [];
  if (linkedAccount) {
    orConditions.push({ customerAccountId: linkedAccount.id });
  }
  if (normalizedEmail) {
    orConditions.push({ customerEmail: normalizedEmail });
  }
  if (orConditions.length === 0) return [];

  const orders = await prisma.order.findMany({
    where: { OR: orConditions },
    include: orderHistoryInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return mapOrderRowsToHistoryEntries(orders);
}

/** List past orders for a verified customer account (order history). */
export async function getOrdersByCustomerAccountId(
  customerAccountId: string
): Promise<OrderHistoryEntry[]> {
  if (!customerAccountId.trim()) return [];

  const orders = await prisma.order.findMany({
    where: { customerAccountId },
    include: orderHistoryInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return mapOrderRowsToHistoryEntries(orders);
}

/** Recent completed orders for verified customer account ("order again" surfaces). */
export async function getRecentCompletedOrdersForCustomerAccount(
  customerAccountId: string,
  take: number
): Promise<OrderHistoryEntry[]> {
  const all = await getOrdersByCustomerAccountId(customerAccountId);
  const terminal = all.filter((o) => o.status === "completed" || o.status === "partially_completed");
  return terminal.slice(0, Math.max(0, take));
}

/** @deprecated Prefer getOrdersByCustomerAccountId. Phone-based lookup only. */
export async function getOrdersByCustomerPhone(customerPhone: string): Promise<OrderHistoryEntry[]> {
  const normalized = customerPhone.trim();
  if (!normalized) return [];

  const orders = await prisma.order.findMany({
    where: { customerPhone: normalized },
    include: orderHistoryInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return mapOrderRowsToHistoryEntries(orders);
}

/** @deprecated Prefer getRecentCompletedOrdersForCustomerAccount. */
export async function getRecentCompletedOrdersForPhone(
  customerPhone: string,
  take: number
): Promise<OrderHistoryEntry[]> {
  const all = await getOrdersByCustomerPhone(customerPhone);
  const terminal = all.filter((o) => o.status === "completed" || o.status === "partially_completed");
  return terminal.slice(0, Math.max(0, take));
}
