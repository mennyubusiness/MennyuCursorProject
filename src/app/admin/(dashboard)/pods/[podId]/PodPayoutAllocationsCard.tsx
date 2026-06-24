"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { reEvaluateRepairablePodPayoutAllocationsAction } from "@/actions/admin-pod-payout-settings.actions";
import {
  POD_PAYOUT_BLOCKED_REASON_LABELS,
  POD_PAYOUT_ALLOCATION_STATUS,
} from "@/lib/pod-payout-allocation";
import { podRevenueShareBpsToPercentLabel } from "@/lib/pod-payout-settings";
import type { AdminPodPayoutAllocationRow } from "@/services/pod-payout-allocation.service";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…`;
}

const FILTER_OPTIONS = [
  { id: "all", label: "All" },
  { id: POD_PAYOUT_ALLOCATION_STATUS.pending, label: "Pending" },
  { id: POD_PAYOUT_ALLOCATION_STATUS.blocked, label: "Blocked" },
  { id: POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund, label: "Cancelled" },
] as const;

type FilterId = (typeof FILTER_OPTIONS)[number]["id"];

function statusLabel(status: string): string {
  switch (status) {
    case POD_PAYOUT_ALLOCATION_STATUS.pending:
      return "Pending";
    case POD_PAYOUT_ALLOCATION_STATUS.blocked:
      return "Blocked";
    case POD_PAYOUT_ALLOCATION_STATUS.cancelledDueToRefund:
      return "Cancelled";
    case POD_PAYOUT_ALLOCATION_STATUS.blockedPartialRefundReview:
      return "Refund review";
    default:
      return status;
  }
}

function blockedReasonLabel(reason: string | null): string {
  if (!reason) return "—";
  return POD_PAYOUT_BLOCKED_REASON_LABELS[reason] ?? reason;
}

export function PodPayoutAllocationsCard({
  podId,
  allocations,
}: {
  podId: string;
  allocations: AdminPodPayoutAllocationRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterId>("all");
  const [reevalPending, setReevalPending] = useState(false);
  const [reevalMessage, setReevalMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return allocations;
    return allocations.filter((row) => row.status === filter);
  }, [allocations, filter]);

  const repairableBlockedCount = allocations.filter(
    (row) =>
      row.status === POD_PAYOUT_ALLOCATION_STATUS.blocked &&
      (row.blockedReason === "missing_recipient" || row.blockedReason === "invalid_bps")
  ).length;

  async function handleReevaluate() {
    setReevalMessage(null);
    setReevalPending(true);
    const result = await reEvaluateRepairablePodPayoutAllocationsAction(podId);
    setReevalPending(false);
    if (!result.ok) {
      setReevalMessage(result.error);
      return;
    }
    setReevalMessage(
      result.repaired > 0
        ? `Re-evaluated ${result.examined} blocked row(s); ${result.repaired} moved to pending.`
        : `Re-evaluated ${result.examined} blocked row(s); none could be repaired.`
    );
    router.refresh();
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Allocations</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Recent pod payout calculation records after successful customer payment.
          </p>
        </div>
        {repairableBlockedCount > 0 ? (
          <button
            type="button"
            onClick={handleReevaluate}
            disabled={reevalPending}
            className="rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-1.5 text-xs font-medium text-oo-charcoal hover:bg-oo-warm-white disabled:opacity-50"
          >
            {reevalPending ? "Re-evaluating…" : "Re-evaluate blocked allocations"}
          </button>
        ) : null}
      </div>

      {reevalMessage ? <p className="mt-3 text-xs text-oo-stone-gray">{reevalMessage}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setFilter(opt.id)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              filter === opt.id
                ? "bg-oo-charcoal text-white"
                : "bg-oo-cream text-oo-charcoal hover:bg-oo-light-stone/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-4 text-sm text-oo-stone-gray">No allocations match this filter.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-oo-light-stone">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone bg-oo-cream text-left text-xs uppercase tracking-wide text-oo-stone-gray">
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">Eligible food subtotal</th>
                <th className="px-3 py-2">Revenue share</th>
                <th className="px-3 py-2">Allocation</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Recipient</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-oo-light-stone last:border-b-0">
                  <td className="px-3 py-2 text-xs text-oo-charcoal">
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(row.createdAt)}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/orders/${row.orderId}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      {shortenId(row.orderId)}
                    </Link>
                    <p className="font-mono text-[10px] text-oo-stone-gray" title={row.paymentId}>
                      pay {shortenId(row.paymentId)}
                    </p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-oo-charcoal">
                    {formatMoney(row.eligibleSubtotalCents)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-oo-charcoal">
                    {podRevenueShareBpsToPercentLabel(row.revenueShareBps)}
                  </td>
                  <td className="px-3 py-2 tabular-nums font-medium text-oo-charcoal">
                    {formatMoney(row.podPayoutAmountCents)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.status === POD_PAYOUT_ALLOCATION_STATUS.pending
                          ? "bg-emerald-100 text-emerald-900"
                          : row.status === POD_PAYOUT_ALLOCATION_STATUS.blocked
                            ? "bg-amber-100 text-amber-900"
                            : "bg-stone-200 text-oo-charcoal"
                      }`}
                    >
                      {statusLabel(row.status)}
                    </span>
                    {row.blockedReason ? (
                      <p className="mt-0.5 text-[10px] text-oo-stone-gray">
                        {blockedReasonLabel(row.blockedReason)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-xs text-oo-charcoal">
                    {row.recipientLabel ?? (
                      <span className="text-oo-stone-gray">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
