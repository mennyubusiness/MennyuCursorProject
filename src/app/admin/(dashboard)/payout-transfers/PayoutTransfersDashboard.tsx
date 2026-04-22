"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminRetryVendorPayoutTransferAction } from "@/actions/admin-payout-transfer.actions";
import {
  adminRetryTransferReversalAction,
  adminRunTransferReversalBatchAction,
} from "@/actions/admin-payout-transfer-reversal.actions";
import { adminRunVendorPayoutTransferBatchAction } from "@/actions/admin-payout-transfer.actions";
import type {
  AdminPayoutTransferRow,
  AdminTransferReversalRow,
  AdminVendorOption,
} from "./payout-transfers-admin.types";

export type { AdminPayoutTransferRow, AdminTransferReversalRow, AdminVendorOption } from "./payout-transfers-admin.types";

type DatePreset = "all" | "today" | "7d";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

function shortenDestination(id: string): string {
  const t = id.trim();
  if (t === "blocked") return "blocked";
  if (t.startsWith("acct_") && t.length > 14) return `${t.slice(0, 10)}…${t.slice(-4)}`;
  if (t.length > 18) return `${t.slice(0, 10)}…${t.slice(-4)}`;
  return t;
}

function shortenStripeId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

function statusFilterBucket(status: string): "pending" | "paid" | "failed" | "blocked" {
  if (status === "blocked") return "blocked";
  if (status === "failed") return "failed";
  if (status === "paid") return "paid";
  if (status === "pending" || status === "submitted") return "pending";
  return "pending";
}

function statusBadgeClass(status: string): string {
  const b = statusFilterBucket(status);
  if (b === "paid") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (b === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (b === "blocked") return "bg-amber-100 text-amber-950 ring-amber-200";
  return "bg-stone-100 text-stone-800 ring-stone-200";
}

/** Reversal statuses: pending | submitted | reversed | failed | not_needed */
function reversalStatusBadgeClass(status: string): string {
  if (status === "reversed") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (status === "not_needed") return "bg-stone-100 text-stone-600 ring-stone-200";
  return "bg-stone-100 text-stone-800 ring-stone-200";
}

function reversalMatchesPayoutStatusFilter(
  status: string,
  filter: string
): boolean {
  if (filter === "all") return true;
  if (filter === "failed") return status === "failed";
  if (filter === "paid") return status === "reversed";
  if (filter === "blocked") return false;
  if (filter === "pending") return status === "pending" || status === "submitted";
  return status === filter;
}

function normalizeTransferRow(t: AdminPayoutTransferRow): AdminPayoutTransferRow {
  return {
    ...t,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date(t.createdAt as unknown as Date).toISOString(),
    submittedAt:
      t.submittedAt == null
        ? null
        : typeof t.submittedAt === "string"
          ? t.submittedAt
          : new Date(t.submittedAt as unknown as Date).toISOString(),
    failedAt:
      t.failedAt == null
        ? null
        : typeof t.failedAt === "string"
          ? t.failedAt
          : new Date(t.failedAt as unknown as Date).toISOString(),
  };
}

function normalizeReversalRow(r: AdminTransferReversalRow): AdminTransferReversalRow {
  return {
    ...r,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as unknown as Date).toISOString(),
    submittedAt:
      r.submittedAt == null
        ? null
        : typeof r.submittedAt === "string"
          ? r.submittedAt
          : new Date(r.submittedAt as unknown as Date).toISOString(),
    failedAt:
      r.failedAt == null
        ? null
        : typeof r.failedAt === "string"
          ? r.failedAt
          : new Date(r.failedAt as unknown as Date).toISOString(),
  };
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

function FailureText({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return <span className="text-stone-400">—</span>;
  const t = text.trim();
  const short = t.length > 140;
  const shown = short && !open ? `${t.slice(0, 140)}…` : t;
  return (
    <div className="max-w-xs">
      <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-stone-700">{shown}</p>
      {short && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-semibold text-mennyu-primary hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function groupTransferKey(row: AdminPayoutTransferRow): string {
  const bk = row.batchKey?.trim();
  if (bk) return `batch:${bk}`;
  return `day:${row.createdAt.slice(0, 10)}`;
}

function groupReversalKey(row: AdminTransferReversalRow): string {
  const bk = row.batchKey?.trim();
  if (bk) return `batch:${bk}`;
  return `day:${row.createdAt.slice(0, 10)}`;
}

export function PayoutTransfersDashboard({
  initialTransfers,
  initialReversals,
  vendors,
}: {
  initialTransfers: AdminPayoutTransferRow[];
  initialReversals: AdminTransferReversalRow[];
  vendors: AdminVendorOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [transfers, setTransfers] = useState(initialTransfers);
  const [reversals, setReversals] = useState(initialReversals);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendorId, setVendorId] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedRevGroups, setExpandedRevGroups] = useState<Record<string, boolean>>({});

  const [batchKey, setBatchKey] = useState("");
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchErr, setBatchErr] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<"payout" | "reversal" | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [retryPayoutId, setRetryPayoutId] = useState<string | null>(null);
  const [retryReversalId, setRetryReversalId] = useState<string | null>(null);

  useEffect(() => {
    setTransfers(initialTransfers);
    setReversals(initialReversals);
  }, [initialTransfers, initialReversals]);

  const vendorsFiltered = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q));
  }, [vendors, vendorSearch]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (!inDateRange(t.createdAt, datePreset)) return false;
      if (vendorId && t.vendorId !== vendorId) return false;
      if (statusFilter !== "all" && statusFilterBucket(t.status) !== statusFilter) return false;
      return true;
    });
  }, [transfers, datePreset, vendorId, statusFilter]);

  const filteredReversals = useMemo(() => {
    return reversals.filter((r) => {
      if (!inDateRange(r.createdAt, datePreset)) return false;
      if (vendorId && r.vendorId !== vendorId) return false;
      if (!reversalMatchesPayoutStatusFilter(r.status, statusFilter)) return false;
      return true;
    });
  }, [reversals, datePreset, vendorId, statusFilter]);

  const summary = useMemo(() => {
    let pendingCents = 0;
    let paidCents = 0;
    let failed = 0;
    let blocked = 0;
    for (const t of filteredTransfers) {
      const bucket = statusFilterBucket(t.status);
      if (bucket === "pending") pendingCents += t.amountCents;
      if (bucket === "paid") paidCents += t.amountCents;
      if (bucket === "failed") failed++;
      if (bucket === "blocked") blocked++;
    }
    return { pendingCents, paidCents, failed, blocked };
  }, [filteredTransfers]);

  const transferGroups = useMemo(() => {
    const map = new Map<string, AdminPayoutTransferRow[]>();
    for (const t of filteredTransfers) {
      const k = groupTransferKey(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    const entries = [...map.entries()].sort((a, b) => {
      const ta = Math.max(...a[1].map((x) => new Date(x.createdAt).getTime()));
      const tb = Math.max(...b[1].map((x) => new Date(x.createdAt).getTime()));
      return tb - ta;
    });
    return entries;
  }, [filteredTransfers]);

  const reversalGroups = useMemo(() => {
    const map = new Map<string, AdminTransferReversalRow[]>();
    for (const r of filteredReversals) {
      const k = groupReversalKey(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort((a, b) => {
      const ta = Math.max(...a[1].map((x) => new Date(x.createdAt).getTime()));
      const tb = Math.max(...b[1].map((x) => new Date(x.createdAt).getTime()));
      return tb - ta;
    });
  }, [filteredReversals]);

  function groupTitle(key: string): string {
    if (key.startsWith("batch:")) return `Batch ${key.slice("batch:".length)}`;
    return `Date ${key.slice("day:".length)}`;
  }

  function isGroupOpen(key: string, map: Record<string, boolean>) {
    return map[key] !== false;
  }

  function toggleGroup(key: string, setMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) {
    setMap((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  async function runPayoutBatch() {
    setBatchBusy("payout");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminRunVendorPayoutTransferBatchAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setBatchErr(r.error);
        return;
      }
      setBatchMsg(`Payout batch: examined ${r.summary.examined}, settled ${r.summary.settled}, skipped ${r.summary.skipped}, failed ${r.summary.failed}.`);
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function runReversalBatch() {
    setBatchBusy("reversal");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminRunTransferReversalBatchAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setBatchErr(r.error);
        return;
      }
      setBatchMsg(
        `Reversal batch: examined ${r.summary.examined}, reversed ${r.summary.reversed}, skipped ${r.summary.skipped}, failed ${r.summary.failed}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function retryTransfer(id: string) {
    setRetryPayoutId(id);
    try {
      const r = await adminRetryVendorPayoutTransferAction(id);
      if (!r.ok || !r.transfer) {
        alert(r.ok === false ? r.error : "Retry failed");
        return;
      }
      const row = normalizeTransferRow(r.transfer);
      setTransfers((prev) => prev.map((t) => (t.id === id ? row : t)));
    } finally {
      setRetryPayoutId(null);
    }
  }

  async function retryReversal(id: string) {
    setRetryReversalId(id);
    try {
      const r = await adminRetryTransferReversalAction(id);
      if (!r.ok || !r.reversal) {
        alert(r.ok === false ? r.error : "Retry failed");
        return;
      }
      const row = normalizeReversalRow(r.reversal);
      setReversals((prev) => prev.map((x) => (x.id === id ? row : x)));
    } finally {
      setRetryReversalId(null);
    }
  }

  const actionLocked = batchBusy !== null || retryPayoutId !== null || retryReversalId !== null;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runPayoutBatch()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-stone-800 disabled:opacity-50"
            >
              {batchBusy === "payout" ? "Running…" : "Run payout batch"}
            </button>
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runReversalBatch()}
              className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-900 shadow-sm hover:bg-stone-50 disabled:opacity-50"
            >
              {batchBusy === "reversal" ? "Running…" : "Run reversal batch"}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
              >
                <option value="all">All</option>
                <option value="pending">Pending / submitted</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-stone-600">
              Vendor
              <input
                type="search"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Filter list…"
                className="mb-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm text-stone-900"
              />
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
              >
                <option value="">All vendors</option>
                {vendorsFiltered.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Date range
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-900"
              >
                <option value="all">All</option>
                <option value="today">Today (UTC)</option>
                <option value="7d">Last 7 days</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-stone-600">
              Batch key (optional)
              <input
                type="text"
                value={batchKey}
                onChange={(e) => setBatchKey(e.target.value)}
                placeholder="UTC date or label"
                className="w-40 rounded-lg border border-stone-300 px-2 py-1.5 font-mono text-xs text-stone-900"
              />
            </label>
          </div>
        </div>
        {batchErr && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {batchErr}
          </p>
        )}
        {batchMsg && <p className="mt-3 text-sm text-emerald-800">{batchMsg}</p>}
      </div>

      <div className="grid gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Pending (filtered)</p>
          <p className="mt-1 text-lg font-semibold text-stone-900">{formatMoney(summary.pendingCents, "usd")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Paid (filtered)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-900">{formatMoney(summary.paidCents, "usd")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Failed rows</p>
          <p className="mt-1 text-lg font-semibold text-red-800">{summary.failed}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Blocked rows</p>
          <p className="mt-1 text-lg font-semibold text-amber-900">{summary.blocked}</p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Payout transfers</h2>
        <p className="text-sm text-stone-600">
          Stripe Connect transfers from allocations. Retries reset failed rows to pending then call Stripe (idempotent
          keys).
        </p>
        {transferGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            No transfers match filters.
          </p>
        ) : (
          transferGroups.map(([gKey, rows]) => {
            const open = isGroupOpen(gKey, expandedGroups);
            const total = rows.reduce((s, r) => s + r.amountCents, 0);
            return (
              <div key={gKey} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleGroup(gKey, setExpandedGroups)}
                  className="flex w-full items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 text-left text-sm font-semibold text-stone-900 hover:bg-stone-100"
                >
                  <span>{groupTitle(gKey)}</span>
                  <span className="text-xs font-normal text-stone-600">
                    {rows.length} transfer{rows.length !== 1 ? "s" : ""} · {formatMoney(total, rows[0]?.currency ?? "usd")}
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-stone-200 bg-white text-xs font-medium uppercase text-stone-500">
                        <tr>
                          <th className="px-3 py-2">Vendor</th>
                          <th className="px-3 py-2">Order</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2">Destination</th>
                          <th className="px-3 py-2">Created / submitted</th>
                          <th className="px-3 py-2">Stripe transfer</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {rows.map((t) => {
                          const bucket = statusFilterBucket(t.status);
                          const reason =
                            bucket === "blocked"
                              ? t.blockedReason
                              : bucket === "failed"
                                ? t.failureMessage
                                : null;
                          const failedRow = bucket === "failed";
                          return (
                            <tr
                              key={t.id}
                              className={failedRow ? "bg-red-50/50" : bucket === "blocked" ? "bg-amber-50/40" : ""}
                            >
                              <td className="px-3 py-2 font-medium text-stone-900">{t.vendor.name}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/admin/orders/${t.vendorOrder.orderId}`}
                                  className="font-mono text-xs text-mennyu-primary hover:underline"
                                >
                                  {t.vendorOrder.orderId.slice(-10)}
                                </Link>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{formatMoney(t.amountCents, t.currency)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(t.status)}`}
                                >
                                  {t.status}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-stone-700">
                                {reason ? (
                                  <span className="font-mono">{reason}</span>
                                ) : (
                                  <span className="text-stone-400">—</span>
                                )}
                                {bucket === "blocked" && (
                                  <div className="mt-1">
                                    <Link
                                      href={`/admin/vendors/${t.vendorId}`}
                                      className="text-xs font-semibold text-mennyu-primary hover:underline"
                                    >
                                      View vendor
                                    </Link>
                                  </div>
                                )}
                              </td>
                              <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs" title={t.destinationAccountId}>
                                {shortenDestination(t.destinationAccountId)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-600">
                                <div>{t.createdAt.slice(0, 19).replace("T", " ")}Z</div>
                                {t.submittedAt && (
                                  <div className="text-stone-500">sub: {t.submittedAt.slice(0, 19).replace("T", " ")}Z</div>
                                )}
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={t.stripeTransferId ?? ""}>
                                {shortenStripeId(t.stripeTransferId)}
                              </td>
                              <td className="px-3 py-2">
                                {bucket === "failed" && (
                                  <button
                                    type="button"
                                    disabled={retryPayoutId !== null}
                                    onClick={() => void retryTransfer(t.id)}
                                    className="rounded-md bg-stone-900 px-2 py-1 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                                  >
                                    {retryPayoutId === t.id ? "Retrying…" : "Retry payout"}
                                  </button>
                                )}
                                {bucket === "paid" && <span className="text-xs text-stone-400">—</span>}
                                {(bucket === "pending" || bucket === "blocked") && (
                                  <span className="text-xs text-stone-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-stone-900">Transfer reversals</h2>
        <p className="text-sm text-stone-600">Stripe transfer reversals after platform refunds.</p>
        {reversalGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-stone-500">
            No reversals match filters.
          </p>
        ) : (
          reversalGroups.map(([gKey, rows]) => {
            const open = isGroupOpen(gKey, expandedRevGroups);
            const total = rows.reduce((s, r) => s + r.amountCents, 0);
            return (
              <div key={gKey} className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleGroup(gKey, setExpandedRevGroups)}
                  className="flex w-full items-center justify-between gap-3 border-b border-stone-100 bg-stone-50 px-4 py-3 text-left text-sm font-semibold text-stone-900 hover:bg-stone-100"
                >
                  <span>{groupTitle(gKey)}</span>
                  <span className="text-xs font-normal text-stone-600">
                    {rows.length} reversal{rows.length !== 1 ? "s" : ""} · {formatMoney(total, rows[0]?.currency ?? "usd")}
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-stone-200 bg-white text-xs font-medium uppercase text-stone-500">
                        <tr>
                          <th className="px-3 py-2">Vendor</th>
                          <th className="px-3 py-2">Order</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Stripe reversal</th>
                          <th className="px-3 py-2">Failure</th>
                          <th className="px-3 py-2">Created</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {rows.map((r) => {
                          const failed = r.status === "failed";
                          return (
                            <tr key={r.id} className={failed ? "bg-red-50/50" : ""}>
                              <td className="px-3 py-2 font-medium text-stone-900">{r.vendor.name}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/admin/orders/${r.orderId}`}
                                  className="font-mono text-xs text-mennyu-primary hover:underline"
                                >
                                  {r.orderId.slice(-10)}
                                </Link>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{formatMoney(r.amountCents, r.currency)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${reversalStatusBadgeClass(r.status)}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={r.stripeTransferReversalId ?? ""}>
                                {shortenStripeId(r.stripeTransferReversalId)}
                              </td>
                              <td className="px-3 py-2">
                                <FailureText text={r.failureMessage} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-stone-600">
                                {r.createdAt.slice(0, 19).replace("T", " ")}Z
                              </td>
                              <td className="px-3 py-2">
                                {failed ? (
                                  <button
                                    type="button"
                                    disabled={retryReversalId !== null}
                                    onClick={() => void retryReversal(r.id)}
                                    className="rounded-md bg-stone-900 px-2 py-1 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
                                  >
                                    {retryReversalId === r.id ? "Retrying…" : "Retry reversal"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-stone-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
