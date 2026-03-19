import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/** Prisma.validator preserves relation payload types; `satisfies` alone made `refundAttempts` infer as `never` in OrderGetPayload. */
export const adminOrderDetailSelect = Prisma.validator<Prisma.OrderSelect>()({
  id: true,
  createdAt: true,
  status: true,
  customerPhone: true,
  customerEmail: true,
  orderNotes: true,
  subtotalCents: true,
  totalCents: true,
  pod: { select: { id: true, name: true } },
  statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, createdAt: true, source: true } },
  issues: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, severity: true, status: true, notes: true, createdAt: true, resolvedAt: true } },
  refundAttempts: { orderBy: { createdAt: "asc" }, select: { id: true, vendorOrderId: true, amountCents: true, status: true, stripeRefundId: true, failureCode: true, failureMessage: true, createdAt: true, dismissedAsLegacyAt: true, dismissedAsLegacyBy: true } },
  vendorOrders: {
    select: {
      id: true,
      orderId: true,
      vendorId: true,
      createdAt: true,
      routingStatus: true,
      fulfillmentStatus: true,
      totalCents: true,
      manuallyRecoveredAt: true,
      deliverectAttempts: true,
      deliverectSubmittedAt: true,
      deliverectLastError: true,
      deliverectOrderId: true,
      vendor: { select: { id: true, name: true } },
      issues: { orderBy: { createdAt: "desc" }, select: { id: true, type: true, severity: true, status: true, notes: true, createdAt: true, resolvedAt: true } },
      statusHistory: { orderBy: { createdAt: "asc" }, select: { id: true, createdAt: true, source: true, routingStatus: true, fulfillmentStatus: true } },
      lineItems: {
        select: {
          id: true,
          name: true,
          quantity: true,
          priceCents: true,
          specialInstructions: true,
          selections: { select: { nameSnapshot: true, quantity: true, modifierOption: { select: { name: true } } } },
        },
      },
    },
  },
});

type OrderDetailPayload = Prisma.OrderGetPayload<{ select: typeof adminOrderDetailSelect }>;

/** Prisma GetPayload can infer `refundAttempts` as `never` for this nested select; pin the row shape to match the query. */
export type AdminOrderRefundAttemptRow = {
  id: string;
  vendorOrderId: string | null;
  amountCents: number;
  status: string;
  stripeRefundId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  createdAt: Date;
  dismissedAsLegacyAt: Date | null;
  dismissedAsLegacyBy: string | null;
};

export type AdminOrderDetail = Omit<OrderDetailPayload, "refundAttempts"> & {
  refundAttempts: AdminOrderRefundAttemptRow[];
};

export async function fetchAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const row = await prisma.order.findUnique({
    where: { id: orderId },
    select: adminOrderDetailSelect,
  });
  return row as AdminOrderDetail | null;
}
