"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  adminReconcilePodPayoutTransferAction,
  adminRetryPodPayoutTransferAction,
  adminRunPodPayoutTransferBatchAction,
} from "@/actions/admin-pod-payout-transfer.actions";
import {
  isReconcilablePodPayoutTransferRow,
  isRetryablePodPayoutTransfer,
} from "@/lib/admin-pod-payout-transfers-ux";
import {
  formatPodPayoutTransferBatchResultMessage,
  POD_PAYOUT_TRANSFER_SKIP_REASON_LABELS,
} from "@/lib/pod-payout-transfer-batch-skip";
import type {
  PodPayoutTransferAdminRow,
  PodPayoutTransferAdminSummary,
} from "@/services/pod-payout-transfer.service";
import type { PodPayoutConnectStatusView } from "@/lib/pod-payout-connect-status";

function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function shortAccountId(accountId: string | null): string {
  if (!accountId || accountId === "blocked") return "—";
  return accountId.length > 12 ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : accountId;
}

export type PodPayoutTransfersCardProps = {
  podId: string;
  transferSummary: PodPayoutTransferAdminSummary;
  transfers: PodPayoutTransferAdminRow[];
  payoutAccountStatus: PodPayoutConnectStatusView | null;
};

export function PodPayoutTransfersCard({
  podId,
  transferSummary,
  transfers,
  payoutAccountStatus,
  showTransferTable = true,
  showRunBatch = false,
}: PodPayoutTransfersCardProps & {
  showTransferTable?: boolean;
  showRunBatch?: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [retryId, setRetryId] = useState<string | null>(null);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [rowNotes, setRowNotes] = useState<Record<string, string>>({});

  async function runBatch() {
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      const result = await adminRunPodPayoutTransferBatchAction(podId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const s = result.summary;
      setMessage(formatPodPayoutTransferBatchResultMessage(s));
      if (s.skippedRows.length > 0) {
        const detail = s.skippedRows
          .slice(0, 8)
          .map(
            (row) =>
              `${row.transferId.slice(-8)}: ${POD_PAYOUT_TRANSFER_SKIP_REASON_LABELS[row.skipReasonKey]}`
          )
          .join("; ");
        setMessage((prev) => `${prev} Skipped rows: ${detail}${s.skippedRows.length > 8 ? "…" : ""}.`);
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function retryRow(id: string) {
    setError(null);
    setRetryId(id);
    try {
      const result = await adminRetryPodPayoutTransferAction(id);
      if (!result.ok) {
        setRowNotes((prev) => ({ ...prev, [id]: result.error }));
        return;
      }
      setRowNotes((prev) => ({ ...prev, [id]: result.message }));
      router.refresh();
    } finally {
      setRetryId(null);
    }
  }

  async function reconcileRow(id: string) {
    setError(null);
    setReconcileId(id);
    try {
      const result = await adminReconcilePodPayoutTransferAction(id);
      if (!result.ok) {
        setRowNotes((prev) => ({ ...prev, [id]: result.error }));
        return;
      }
      setRowNotes((prev) => ({ ...prev, [id]: result.result.message }));
      if (result.result.outcome === "updated_paid" || result.result.outcome === "already_paid") {
        router.refresh();
      }
    } finally {
      setReconcileId(null);
    }
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-oo-charcoal">Payout transfers</h2>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Send eligible pod payout transfers after vendor payouts are handled.
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 rounded-lg border border-oo-light-stone bg-oo-cream/40 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs text-oo-stone-gray">Pending allocation amount</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(transferSummary.pendingAllocationAmountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({transferSummary.pendingAllocationCount})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Transferable amount</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(transferSummary.transferableAmountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({transferSummary.transferableCount})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Blocked / needs review</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(transferSummary.blockedTransferAmountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({transferSummary.blockedTransferCount})
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Minimum payout threshold</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">
            {transferSummary.minimumPayoutCents > 0
              ? formatMoney(transferSummary.minimumPayoutCents)
              : "No minimum"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Payout account status</dt>
          <dd className="mt-0.5 text-sm font-medium text-oo-charcoal">
            {payoutAccountStatus?.adminLabel ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Paid transfers</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-oo-charcoal">
            {formatMoney(transferSummary.paidTransferAmountCents)}
            <span className="ml-1 text-xs font-normal text-oo-stone-gray">
              ({transferSummary.paidTransferCount})
            </span>
          </dd>
        </div>
      </dl>

      {transferSummary.pendingAllocationCount > 0 &&
      transferSummary.transferableCount === 0 &&
      transferSummary.nonTransferableAllocations.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-xs font-semibold text-amber-950">
            Pending allocations not yet transferable
          </p>
          <ul className="mt-2 space-y-1.5 text-xs text-amber-950">
            {transferSummary.nonTransferableAllocations.map((row) => (
              <li key={row.allocationId}>
                <Link href={`/admin/orders/${row.orderId}`} className="font-medium underline">
                  Order {row.orderId.slice(-8)}
                </Link>
                {": "}
                {formatMoney(row.amountCents)} — {row.reasonLabel}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {showRunBatch ? (
          <button
            type="button"
            onClick={() => void runBatch()}
            disabled={pending}
            className="rounded bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "Running batch…" : "Run payout batch"}
          </button>
        ) : (
          <p className="text-sm text-oo-stone-gray">No eligible pod payout transfers right now.</p>
        )}
        <Link
          href="/admin/payout-transfers"
          className="text-sm text-sky-800 underline hover:text-sky-900"
        >
          All payouts
        </Link>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {transfers.length === 0 ? (
        <p className="mt-4 text-sm text-oo-stone-gray">No pod payout transfers yet.</p>
      ) : showTransferTable ? (
        <div className="mt-6 overflow-x-auto rounded-lg border border-oo-light-stone">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-oo-light-stone bg-oo-cream text-left">
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Created
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Order
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Amount
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Destination
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Status
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Stripe transfer
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Batch
              </th>
              <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((row) => (
              <tr key={row.id} className="border-b border-oo-light-stone last:border-b-0">
                <td className="px-3 py-2 text-xs text-oo-charcoal">
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(row.createdAt)}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={`/admin/orders/${row.orderId}`}
                    className="font-medium text-sky-800 hover:underline"
                  >
                    {row.orderId.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums text-oo-charcoal">
                  {formatMoney(row.amountCents)}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-oo-stone-gray">
                  {shortAccountId(row.destinationAccountId)}
                </td>
                <td className="px-3 py-2 text-oo-charcoal">
                  <div>{row.statusLabel}</div>
                  {row.blockedReasonLabel ? (
                    <div className="text-xs text-oo-stone-gray">{row.blockedReasonLabel}</div>
                  ) : null}
                  {row.failureMessage ? (
                    <div className="text-xs text-red-700">{row.failureMessage}</div>
                  ) : null}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-oo-stone-gray">
                  {row.stripeTransferId ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-oo-stone-gray">{row.batchKey ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-1">
                    {isRetryablePodPayoutTransfer(row) ? (
                      <button
                        type="button"
                        disabled={pending || retryId === row.id}
                        onClick={() => void retryRow(row.id)}
                        className="text-left text-xs font-semibold text-orange-900 underline disabled:opacity-50"
                      >
                        {retryId === row.id ? "Retrying…" : "Retry"}
                      </button>
                    ) : null}
                    {isReconcilablePodPayoutTransferRow(row) ? (
                      <button
                        type="button"
                        disabled={pending || reconcileId === row.id}
                        onClick={() => void reconcileRow(row.id)}
                        className="text-left text-xs font-semibold text-sky-800 underline disabled:opacity-50"
                      >
                        {reconcileId === row.id ? "Checking…" : "Check Stripe"}
                      </button>
                    ) : null}
                    {rowNotes[row.id] ? (
                      <p className="text-[10px] text-oo-stone-gray">{rowNotes[row.id]}</p>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-oo-stone-gray">
          {transfers.length} transfer record{transfers.length === 1 ? "" : "s"} on file.
        </p>
      )}
    </section>
  );
}
