"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  adminReconcilePodPayoutTransferAction,
  adminRetryPodPayoutTransferAction,
} from "@/actions/admin-pod-payout-transfer.actions";
import {
  formatRevenueShareBps,
  isReconcilablePodPayoutTransferRow,
  isRetryablePodPayoutTransfer,
  podStatusFilterBucket,
  podTransferIsBlocked,
  podTransferMatchesQuickFilter,
  podTransferNeedsAction,
  podTransferProblemLabel,
  type PodPayoutQuickFilter,
} from "@/lib/admin-pod-payout-transfers-ux";
import { POD_PAYOUT_TRANSFER_STATUS } from "@/lib/pod-payout-transfer-decision";
import type {
  AdminPodOption,
  AdminPodPayoutReadinessRow,
  AdminPodPayoutTransferRow,
  PodPayoutGlobalSummary,
} from "./payout-transfers-admin.types";

type DatePreset = "all" | "today" | "7d";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

function datePresetStart(preset: DatePreset): Date | null {
  if (preset === "all") return null;
  const now = new Date();
  if (preset === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function inDateRange(iso: string, preset: DatePreset): boolean {
  const start = datePresetStart(preset);
  if (!start) return true;
  return new Date(iso).getTime() >= start.getTime();
}

function shortAccountId(accountId: string | null): string {
  if (!accountId || accountId === "blocked") return "—";
  return accountId.length > 12 ? `${accountId.slice(0, 8)}…${accountId.slice(-4)}` : accountId;
}

function podStatusBadgeClass(status: string): string {
  const bucket = podStatusFilterBucket(status);
  if (status === POD_PAYOUT_TRANSFER_STATUS.cancelledDueToRefund) {
    return "bg-slate-100 text-slate-800 ring-slate-200";
  }
  if (bucket === "paid") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (bucket === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (bucket === "blocked") return "bg-amber-100 text-amber-950 ring-amber-200";
  return "bg-oo-cream text-oo-charcoal ring-stone-200";
}

export function AdminPodPayoutTransfersSection({
  transfers,
  pods: _pods,
  summary,
  readiness,
  datePreset,
  statusFilter,
  podId,
  podSearch,
  quickFilter,
  showSummary = true,
  showNeedsAction = true,
  showHistory = true,
  variant = "default",
  actionLocked = false,
}: {
  transfers: AdminPodPayoutTransferRow[];
  pods: AdminPodOption[];
  summary: PodPayoutGlobalSummary;
  readiness: AdminPodPayoutReadinessRow[];
  datePreset: DatePreset;
  statusFilter: string;
  podId: string;
  podSearch: string;
  quickFilter: PodPayoutQuickFilter;
  showSummary?: boolean;
  showNeedsAction?: boolean;
  showHistory?: boolean;
  variant?: "default" | "blocked_only";
  actionLocked?: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [retryId, setRetryId] = useState<string | null>(null);
  const [reconcileId, setReconcileId] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});

  const filteredReadiness = useMemo(() => {
    const q = podSearch.trim().toLowerCase();
    return readiness.filter((row) => {
      if (podId && row.podId !== podId) return false;
      if (!q) return true;
      return row.podName.toLowerCase().includes(q) || row.podId.toLowerCase().includes(q);
    });
  }, [readiness, podId, podSearch]);

  const readyToBatchPods = useMemo(
    () => filteredReadiness.filter((row) => row.canRunPayoutBatch),
    [filteredReadiness]
  );

  const pendingNotReadyPods = useMemo(
    () =>
      filteredReadiness.filter(
        (row) =>
          !row.canRunPayoutBatch &&
          (row.waitingOnVendorCount > 0 ||
            row.blockedAllocationCount > 0 ||
            row.pendingAllocationCount > 0)
      ),
    [filteredReadiness]
  );

  const filtered = useMemo(() => {
    return transfers.filter((row) => {
      if (!inDateRange(row.createdAt, datePreset)) return false;
      if (podId && row.podId !== podId) return false;
      if (statusFilter !== "all" && podStatusFilterBucket(row.status) !== statusFilter) return false;
      if (quickFilter !== "all" && quickFilter !== "default" && !podTransferMatchesQuickFilter(row, quickFilter)) {
        return false;
      }
      if (variant === "blocked_only" && !podTransferIsBlocked(row) && !podTransferNeedsAction(row)) {
        return false;
      }
      const q = podSearch.trim().toLowerCase();
      if (q) {
        const hay = `${row.podName} ${row.recipientEmail ?? ""} ${row.podId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transfers, datePreset, podId, statusFilter, quickFilter, variant, podSearch]);

  const needsActionRows = useMemo(
    () => filtered.filter((row) => podTransferNeedsAction(row)),
    [filtered]
  );

  const hasPodActivity =
    transfers.length > 0 ||
    readiness.length > 0 ||
    summary.pendingAllocationCount > 0 ||
    summary.readyToBatchAmountCents > 0;

  async function retryPodTransfer(id: string) {
    const confirmed = window.confirm(
      "Retry this pod payout transfer? Existing Stripe safety checks apply — no duplicate transfer if one already exists."
    );
    if (!confirmed) return;
    setRetryId(id);
    try {
      const r = await adminRetryPodPayoutTransferAction(id);
      if (!r.ok) {
        setActionNotes((prev) => ({ ...prev, [id]: r.error }));
        return;
      }
      setActionNotes((prev) => ({ ...prev, [id]: r.message }));
      startTransition(() => router.refresh());
    } finally {
      setRetryId(null);
    }
  }

  async function reconcilePodTransfer(id: string) {
    setReconcileId(id);
    try {
      const r = await adminReconcilePodPayoutTransferAction(id);
      if (!r.ok) {
        setActionNotes((prev) => ({ ...prev, [id]: r.error }));
        return;
      }
      const msg =
        r.result.detail && r.result.outcome !== "updated_paid"
          ? `${r.result.message} (${r.result.detail})`
          : r.result.message;
      setActionNotes((prev) => ({ ...prev, [id]: msg }));
      if (r.result.outcome === "updated_paid" || r.result.outcome === "already_paid") {
        startTransition(() => router.refresh());
      }
    } finally {
      setReconcileId(null);
    }
  }

  if (!hasPodActivity) {
    return (
      <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-oo-charcoal">Pod payouts / revenue share</h2>
        <p className="rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/30 p-6 text-center text-sm text-oo-stone-gray">
          No pod payout activity yet. Pod revenue share appears here after orders are paid and pod payout
          allocations are created. Run pod payout batches from each pod&apos;s admin detail page.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {showSummary ? (
        <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-oo-charcoal">Pod payouts / revenue share</h2>
              <p className="mt-1 text-xs text-oo-stone-gray">
                Allocation-level readiness across pods. Pod payout batches run on each pod&apos;s admin detail
                page — this page does not send pod batches directly.
              </p>
            </div>
            <p className="text-xs text-oo-stone-gray">
              Per-row retry and Check Stripe reconciliation available below for existing transfer rows.
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">
                Pending allocations
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-oo-charcoal">
                {formatMoney(summary.pendingAllocationAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.pendingAllocationCount} allocation(s)</p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">
                Ready to batch
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-emerald-950">
                {formatMoney(summary.readyToBatchAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">
                {summary.readyToBatchCount} allocation(s) · {summary.readyToBatchPodCount} pod(s)
              </p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">
                Blocked / needs review
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-orange-900">
                {formatMoney(summary.blockedAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.blockedCount} item(s)</p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">Sent</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-emerald-900">
                {formatMoney(summary.paidAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.paidCount} transfer(s)</p>
            </div>
          </div>
        </div>
      ) : null}

      {readyToBatchPods.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-emerald-950">Pods ready to batch</h3>
            <p className="mt-1 text-xs text-emerald-900">
              Eligible pending allocations with no transfer rows yet, or pending transfer rows ready to send.
              Open the pod payout section to run the batch.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-emerald-200 bg-oo-warm-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-emerald-200 bg-emerald-50/60 text-xs font-medium uppercase text-emerald-950">
                <tr>
                  <th className="px-3 py-2">Pod</th>
                  <th className="px-3 py-2">Ready to batch</th>
                  <th className="px-3 py-2">Pending allocations</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {readyToBatchPods.map((row) => (
                  <tr key={row.podId}>
                    <td className="px-3 py-2 font-medium text-oo-charcoal">{row.podName}</td>
                    <td className="px-3 py-2 tabular-nums text-emerald-950">
                      {formatMoney(row.readyToBatchAmountCents, "usd")}
                      <span className="ml-1 text-xs text-oo-stone-gray">({row.readyToBatchCount})</span>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-oo-charcoal">
                      {formatMoney(row.pendingAllocationAmountCents, "usd")}
                      <span className="ml-1 text-xs text-oo-stone-gray">({row.pendingAllocationCount})</span>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/pods/${row.podId}?section=payouts`}
                        className="text-xs font-semibold text-sky-800 underline"
                      >
                        Open pod payout batch
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {pendingNotReadyPods.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm">
          <div>
            <h3 className="text-base font-semibold text-amber-950">Pending — not yet transferable</h3>
            <p className="mt-1 text-xs text-amber-900">
              Allocations waiting on vendor transfers, Connect setup, refund review, or other blockers.
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-amber-200 bg-oo-warm-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-amber-200 bg-amber-50/60 text-xs font-medium uppercase text-amber-950">
                <tr>
                  <th className="px-3 py-2">Pod</th>
                  <th className="px-3 py-2">Pending</th>
                  <th className="px-3 py-2">Waiting on vendor</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">Top reason</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100">
                {pendingNotReadyPods.map((row) => (
                  <tr key={row.podId}>
                    <td className="px-3 py-2 font-medium text-oo-charcoal">{row.podName}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatMoney(row.pendingAllocationAmountCents, "usd")}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-oo-stone-gray">
                      {row.waitingOnVendorCount > 0
                        ? `${formatMoney(row.waitingOnVendorAmountCents, "usd")} (${row.waitingOnVendorCount})`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-orange-900">
                      {row.blockedAllocationCount + row.blockedTransferCount > 0
                        ? formatMoney(
                            row.blockedAllocationAmountCents + row.blockedTransferAmountCents,
                            "usd"
                          )
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-oo-charcoal">
                      {row.topBlockerReasonLabel ?? "Waiting on dependencies"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/admin/pods/${row.podId}?section=payouts`}
                        className="text-xs font-semibold text-sky-800 underline"
                      >
                        View pod payouts
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {transfers.length === 0 && summary.readyToBatchAmountCents > 0 ? (
        <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-sm text-emerald-950">
          No pod payout transfer rows yet, but{" "}
          <span className="font-semibold tabular-nums">
            {formatMoney(summary.readyToBatchAmountCents, "usd")}
          </span>{" "}
          is ready to batch across {summary.readyToBatchPodCount} pod(s). Use{" "}
          <span className="font-medium">Open pod payout batch</span> above to run batches on each pod detail
          page.
        </p>
      ) : null}

      {showNeedsAction ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod transfer rows — needs action</h3>
          {needsActionRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-4 text-center text-sm text-emerald-950">
              No existing pod payout transfer rows need action for the current filters.
              {summary.readyToBatchAmountCents > 0
                ? ` ${formatMoney(summary.readyToBatchAmountCents, "usd")} is ready to batch on pod detail pages.`
                : null}
            </p>
          ) : (
            <PodTransferTable
              rows={needsActionRows}
              showProblem
              retryId={retryId}
              reconcileId={reconcileId}
              actionLocked={actionLocked}
              actionNotes={actionNotes}
              onRetry={retryPodTransfer}
              onReconcile={reconcilePodTransfer}
            />
          )}
        </section>
      ) : null}

      {showHistory && variant !== "blocked_only" ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod transfer history</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">
              No pod transfer rows match the current filters.
              {summary.readyToBatchAmountCents > 0
                ? ` ${formatMoney(summary.readyToBatchAmountCents, "usd")} is ready to batch on pod detail pages.`
                : null}
            </p>
          ) : (
            <PodTransferTable
              rows={filtered}
              retryId={retryId}
              reconcileId={reconcileId}
              actionLocked={actionLocked}
              actionNotes={actionNotes}
              onRetry={retryPodTransfer}
              onReconcile={reconcilePodTransfer}
            />
          )}
        </section>
      ) : null}

      {variant === "blocked_only" && filtered.length > 0 && !showNeedsAction ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod payouts — blocked / needs review</h3>
          <PodTransferTable
            rows={filtered.filter((r) => podTransferIsBlocked(r))}
            showProblem
            retryId={retryId}
            reconcileId={reconcileId}
            actionLocked={actionLocked}
            actionNotes={actionNotes}
            onRetry={retryPodTransfer}
            onReconcile={reconcilePodTransfer}
          />
        </section>
      ) : null}
    </div>
  );
}

function PodTransferTable({
  rows,
  showProblem,
  retryId,
  reconcileId,
  actionLocked,
  actionNotes,
  onRetry,
  onReconcile,
}: {
  rows: AdminPodPayoutTransferRow[];
  showProblem?: boolean;
  retryId?: string | null;
  reconcileId?: string | null;
  actionLocked?: boolean;
  actionNotes?: Record<string, string>;
  onRetry?: (id: string) => void;
  onReconcile?: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-oo-light-stone">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-oo-light-stone bg-oo-cream/60 text-xs font-medium uppercase text-oo-stone-gray">
          <tr>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Pod</th>
            <th className="px-3 py-2">Recipient</th>
            <th className="px-3 py-2">Order</th>
            <th className="px-3 py-2">Share</th>
            <th className="px-3 py-2">Amount</th>
            {showProblem ? <th className="px-3 py-2">Problem</th> : null}
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Created</th>
            <th className="px-3 py-2">Stripe transfer</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-oo-light-stone">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 text-xs font-medium text-violet-900">Pod</td>
              <td className="px-3 py-2">
                <Link href={`/admin/pods/${row.podId}?section=payouts`} className="font-medium hover:underline">
                  {row.podName}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-oo-charcoal">{row.recipientEmail ?? "—"}</td>
              <td className="px-3 py-2">
                <Link href={`/admin/orders/${row.orderId}`} className="font-mono text-xs hover:underline">
                  {row.orderId.slice(-10)}
                </Link>
              </td>
              <td className="px-3 py-2 text-xs text-oo-stone-gray">{formatRevenueShareBps(row.revenueShareBps)}</td>
              <td className="px-3 py-2 tabular-nums">{formatMoney(row.amountCents, row.currency)}</td>
              {showProblem ? (
                <td className="px-3 py-2 text-xs text-oo-charcoal">{podTransferProblemLabel(row)}</td>
              ) : null}
              <td className="px-3 py-2">
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${podStatusBadgeClass(row.status)}`}
                  >
                    {row.statusLabel}
                  </span>
                </div>
                {row.blockedReasonLabel ? (
                  <p className="mt-1 text-xs text-oo-stone-gray">{row.blockedReasonLabel}</p>
                ) : null}
                {row.failureMessage ? (
                  <p className="mt-1 text-xs text-red-700">{row.failureMessage}</p>
                ) : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-xs text-oo-stone-gray">
                {row.createdAt.slice(0, 19).replace("T", " ")}Z
              </td>
              <td className="px-3 py-2 font-mono text-xs text-oo-stone-gray">
                {row.stripeTransferId ?? "—"}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-col gap-1">
                  {isRetryablePodPayoutTransfer(row) && onRetry ? (
                    <button
                      type="button"
                      disabled={actionLocked || retryId === row.id}
                      onClick={() => void onRetry(row.id)}
                      className="text-left text-xs font-semibold text-orange-900 underline disabled:opacity-50"
                    >
                      {retryId === row.id ? "Retrying…" : "Retry"}
                    </button>
                  ) : null}
                  {isReconcilablePodPayoutTransferRow(row) && onReconcile ? (
                    <button
                      type="button"
                      disabled={actionLocked || reconcileId === row.id}
                      onClick={() => void onReconcile(row.id)}
                      className="text-left text-xs font-semibold text-sky-800 underline disabled:opacity-50"
                    >
                      {reconcileId === row.id ? "Checking…" : "Check Stripe"}
                    </button>
                  ) : null}
                  <Link
                    href={`/admin/pods/${row.podId}?section=payouts`}
                    className="text-xs font-semibold text-sky-800 underline"
                  >
                    Open pod payout batch
                  </Link>
                  {actionNotes?.[row.id] ? (
                    <p className="text-[10px] text-oo-stone-gray">{actionNotes[row.id]}</p>
                  ) : (
                    <p className="text-[10px] text-oo-stone-gray">Batch on pod detail</p>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
