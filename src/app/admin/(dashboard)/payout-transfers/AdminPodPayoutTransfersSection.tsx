"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  formatRevenueShareBps,
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
  pods,
  summary,
  datePreset,
  statusFilter,
  podId,
  podSearch,
  quickFilter,
  showSummary = true,
  showNeedsAction = true,
  showHistory = true,
  variant = "default",
}: {
  transfers: AdminPodPayoutTransferRow[];
  pods: AdminPodOption[];
  summary: PodPayoutGlobalSummary;
  datePreset: DatePreset;
  statusFilter: string;
  podId: string;
  podSearch: string;
  quickFilter: PodPayoutQuickFilter;
  showSummary?: boolean;
  showNeedsAction?: boolean;
  showHistory?: boolean;
  variant?: "default" | "blocked_only";
}) {
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

  if (transfers.length === 0) {
    return (
      <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-oo-charcoal">Pod payouts / revenue share</h2>
        <p className="rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/30 p-6 text-center text-sm text-oo-stone-gray">
          No pod payout transfers yet. Pod revenue share transfers appear here after orders are paid and pod payout
          batches run from a pod&apos;s admin detail page.
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
                Stripe Connect transfers to pod payout account owners. Run batches per pod from pod admin detail.
              </p>
            </div>
            <p className="text-xs text-oo-stone-gray">
              Reconcile / per-row retry:{" "}
              <span className="font-medium text-oo-charcoal">Not available for pod transfers yet</span>
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">Needs action</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-amber-950">
                {formatMoney(summary.needsActionAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.needsActionCount}</p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">Ready to send</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-oo-charcoal">
                {formatMoney(summary.readyToTransferAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.readyToTransferCount}</p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">Blocked</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-orange-900">
                {formatMoney(summary.blockedAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.blockedCount}</p>
            </div>
            <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-oo-stone-gray">Sent</p>
              <p className="mt-1 text-base font-semibold tabular-nums text-emerald-900">
                {formatMoney(summary.paidAmountCents, "usd")}
              </p>
              <p className="text-xs text-oo-stone-gray">{summary.paidCount}</p>
            </div>
          </div>
        </div>
      ) : null}

      {showNeedsAction ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod payouts — needs action</h3>
          {needsActionRows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/30 p-4 text-center text-sm text-emerald-950">
              No pod payout transfers need action for the current filters.
            </p>
          ) : (
            <PodTransferTable rows={needsActionRows} showProblem />
          )}
        </section>
      ) : null}

      {showHistory && variant !== "blocked_only" ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod transfer history</h3>
          {filtered.length === 0 ? (
            <p className="text-sm text-oo-stone-gray">No pod transfers match the current filters.</p>
          ) : (
            <PodTransferTable rows={filtered} />
          )}
        </section>
      ) : null}

      {variant === "blocked_only" && filtered.length > 0 && !showNeedsAction ? (
        <section className="space-y-3 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Pod payouts — blocked / needs review</h3>
          <PodTransferTable rows={filtered.filter((r) => podTransferIsBlocked(r))} showProblem />
        </section>
      ) : null}
    </div>
  );
}

function PodTransferTable({
  rows,
  showProblem,
}: {
  rows: AdminPodPayoutTransferRow[];
  showProblem?: boolean;
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
                <Link
                  href={`/admin/pods/${row.podId}?section=payouts`}
                  className="text-xs font-semibold text-sky-800 underline"
                >
                  Pod payouts
                </Link>
                <p className="mt-1 text-[10px] text-oo-stone-gray">Batch on pod detail</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
