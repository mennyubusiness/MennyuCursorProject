import "server-only";

import { prisma } from "@/lib/db";

export type VendorPayoutTransferRow = {
  id: string;
  amountCents: number;
  status: string;
  blockedReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  vendorOrderId: string;
  orderId: string;
  pickupHint: string | null;
};

export type VendorPayoutSummary = {
  estimatedEarningsCents: number;
  tipsCents: number;
  pendingTransferCents: number;
  paidTransferCents: number;
  transfers: VendorPayoutTransferRow[];
};

export async function getVendorPayoutSummary(vendorId: string): Promise<VendorPayoutSummary> {
  const [transfers, completedOrders] = await Promise.all([
    prisma.vendorPayoutTransfer.findMany({
      where: { vendorId },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        amountCents: true,
        status: true,
        blockedReason: true,
        createdAt: true,
        submittedAt: true,
        vendorOrderId: true,
        vendorOrder: {
          select: {
            orderId: true,
            tipCents: true,
            vendorNetPayoutCents: true,
            order: { select: { orderNotes: true } },
          },
        },
      },
    }),
    prisma.vendorOrder.aggregate({
      where: { vendorId, fulfillmentStatus: "completed" },
      _sum: { vendorNetPayoutCents: true, tipCents: true },
    }),
  ]);

  let pendingTransferCents = 0;
  let paidTransferCents = 0;
  for (const row of transfers) {
    if (row.status === "paid") paidTransferCents += row.amountCents;
    else if (row.status === "pending" || row.status === "submitted") {
      pendingTransferCents += row.amountCents;
    }
  }

  return {
    estimatedEarningsCents: completedOrders._sum.vendorNetPayoutCents ?? 0,
    tipsCents: completedOrders._sum.tipCents ?? 0,
    pendingTransferCents,
    paidTransferCents,
    transfers: transfers.map((row) => ({
      id: row.id,
      amountCents: row.amountCents,
      status: row.status,
      blockedReason: row.blockedReason,
      createdAt: row.createdAt.toISOString(),
      submittedAt: row.submittedAt?.toISOString() ?? null,
      vendorOrderId: row.vendorOrderId,
      orderId: row.vendorOrder.orderId,
      pickupHint: row.vendorOrder.order.orderNotes?.trim() || null,
    })),
  };
}
