import { prisma } from "@/lib/db";
import { PayoutTransferBatchPanel } from "./PayoutTransferBatchPanel";

export default async function AdminPayoutTransfersPage() {
  const transfers = await prisma.vendorPayoutTransfer.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
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
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900">Vendor payout transfers</h1>
        <p className="mt-1 text-sm text-stone-600">
          Execution state for Stripe Connect transfers (source amount: PaymentAllocation.netVendorTransferCents).
        </p>
      </div>

      <PayoutTransferBatchPanel />

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase text-stone-500">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Vendor order</th>
              <th className="px-3 py-2">Allocation</th>
              <th className="px-3 py-2">Destination</th>
              <th className="px-3 py-2">Stripe transfer</th>
              <th className="px-3 py-2">Note</th>
              <th className="px-3 py-2">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {transfers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-stone-500">
                  No transfer rows yet. They are created when payments succeed.
                </td>
              </tr>
            ) : (
              transfers.map((t) => (
                <tr key={t.id} className="font-mono text-xs text-stone-800">
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2">
                    {(t.amountCents / 100).toFixed(2)} {t.currency}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2" title={t.vendorOrderId}>
                    {t.vendorOrderId.slice(-12)}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2" title={t.paymentAllocationId}>
                    {t.paymentAllocationId.slice(-12)}
                  </td>
                  <td className="max-w-[160px] truncate px-3 py-2" title={t.destinationAccountId}>
                    {t.destinationAccountId}
                  </td>
                  <td className="max-w-[120px] truncate px-3 py-2">{t.stripeTransferId ?? "—"}</td>
                  <td className="max-w-[200px] truncate text-stone-600" title={t.blockedReason ?? t.failureMessage ?? ""}>
                    {t.blockedReason ?? t.failureMessage ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                    {t.createdAt.toISOString().slice(0, 19)}Z
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
