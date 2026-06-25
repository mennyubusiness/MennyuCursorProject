"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminRunPodPayoutTransferBatchAction } from "@/actions/admin-pod-payout-transfer.actions";
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
      setMessage(
        `Batch ${s.batchKey}: created ${s.rowsCreated} transfer row(s), examined ${s.examined}, settled ${s.settled}, skipped ${s.skipped}, failed ${s.failed}.` +
          (s.stoppedEarlyForBalance ? " Stopped early due to insufficient Stripe balance." : "")
      );
      router.refresh();
    } finally {
      setPending(false);
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
          <dt className="text-xs text-oo-stone-gray">Blocked transfer amount</dt>
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
          Vendor payouts
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
