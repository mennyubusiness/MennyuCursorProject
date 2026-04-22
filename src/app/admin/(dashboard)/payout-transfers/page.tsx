import { prisma } from "@/lib/db";
import type {
  AdminPayoutTransferRow,
  AdminTransferReversalRow,
  AdminVendorOption,
} from "./payout-transfers-admin.types";
import { PayoutTransfersDashboard } from "./PayoutTransfersDashboard";

const TRANSFER_TAKE = 400;
const REVERSAL_TAKE = 400;

export default async function AdminPayoutTransfersPage() {
  const [vendors, transfers, reversals] = await Promise.all([
    prisma.vendor.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.vendorPayoutTransfer.findMany({
      orderBy: { createdAt: "desc" },
      take: TRANSFER_TAKE,
      select: {
        id: true,
        paymentAllocationId: true,
        vendorOrderId: true,
        vendorId: true,
        destinationAccountId: true,
        amountCents: true,
        currency: true,
        status: true,
        blockedReason: true,
        stripeTransferId: true,
        idempotencyKey: true,
        batchKey: true,
        failureMessage: true,
        createdAt: true,
        submittedAt: true,
        failedAt: true,
        vendor: { select: { id: true, name: true } },
        vendorOrder: { select: { id: true, orderId: true } },
      },
    }),
    prisma.vendorPayoutTransferReversal.findMany({
      orderBy: { createdAt: "desc" },
      take: REVERSAL_TAKE,
      select: {
        id: true,
        vendorPayoutTransferId: true,
        vendorOrderId: true,
        orderId: true,
        refundAttemptId: true,
        amountCents: true,
        currency: true,
        status: true,
        stripeTransferReversalId: true,
        failureMessage: true,
        batchKey: true,
        createdAt: true,
        submittedAt: true,
        failedAt: true,
        vendorId: true,
        vendor: { select: { id: true, name: true } },
        vendorOrder: { select: { id: true, orderId: true } },
        order: { select: { id: true } },
      },
    }),
  ]);

  const initialTransfers: AdminPayoutTransferRow[] = transfers.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    submittedAt: t.submittedAt?.toISOString() ?? null,
    failedAt: t.failedAt?.toISOString() ?? null,
  }));

  const initialReversals: AdminTransferReversalRow[] = reversals.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    submittedAt: r.submittedAt?.toISOString() ?? null,
    failedAt: r.failedAt?.toISOString() ?? null,
  }));

  const vendorOptions: AdminVendorOption[] = vendors.map((v) => ({ id: v.id, name: v.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Payout transfers</h1>
        <p className="mt-1 text-sm text-stone-600">
          Stripe Connect transfer execution and reversals. Use filters and retries for safe testing and debugging.
        </p>
      </div>

      <PayoutTransfersDashboard
        initialTransfers={initialTransfers}
        initialReversals={initialReversals}
        vendors={vendorOptions}
      />
    </div>
  );
}
