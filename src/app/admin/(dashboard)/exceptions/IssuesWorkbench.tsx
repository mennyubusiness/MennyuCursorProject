"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminAttentionItem, AdminAttentionReason } from "@/lib/admin-attention";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import type { AdminResolvedIssueHistoryRow } from "@/services/issues.service";

type PodOption = { id: string; name: string };

const STATUS_OPTIONS: { value: AdminAttentionReason | "all"; label: string }[] = [
  { value: "all", label: "All types" },
  { value: "routing_failed", label: "Routing failure" },
  { value: "routing_stuck", label: "Stuck routing" },
  { value: "deliverect_reconciliation_overdue", label: "POS confirmation overdue" },
  { value: "fulfillment_stuck", label: "Fulfillment stalled" },
  { value: "open_issue", label: "Tracked issue" },
  { value: "refund_failed", label: "Refund failed" },
  { value: "financial_resolution", label: "Financial resolution" },
  { value: "unknown_attention_needed", label: "Other" },
];

const TIME_OPTIONS = [
  { value: "1h", maxMinutes: 60 },
  { value: "24h", maxMinutes: 24 * 60 },
  { value: "all", maxMinutes: Infinity },
] as const;

function issueTitle(reason: AdminAttentionReason): string {
  switch (reason) {
    case "routing_failed":
      return "Routing failure";
    case "routing_stuck":
      return "Stuck order";
    case "deliverect_reconciliation_overdue":
      return "POS confirmation overdue";
    case "fulfillment_stuck":
      return "Fulfillment stalled";
    case "open_issue":
      return "Tracked issue";
    case "refund_failed":
      return "Refund failed";
    case "financial_resolution":
      return "Financial resolution";
    default:
      return "Needs review";
  }
}

function formatRelativeFromAgeMinutes(ageMinutes: number): string {
  if (ageMinutes < 1) return "just now";
  if (ageMinutes < 60) return `${ageMinutes}m ago`;
  const h = Math.floor(ageMinutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function oneLine(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function borderClass(severity: AdminAttentionItem["severity"]): string {
  if (severity === "critical") return "border-l-4 border-l-red-500";
  if (severity === "high" || severity === "medium") return "border-l-4 border-l-amber-400";
  return "border-l-4 border-l-stone-300";
}

function humanizeIssueType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatResolvedAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function getRefundAttemptIdFromItemId(itemId: string): string | null {
  if (!itemId.startsWith("refund_attempt:")) return null;
  return itemId.slice("refund_attempt:".length) || null;
}

export function IssuesWorkbench({
  initialActiveItems,
  resolvedHistory,
  pods,
}: {
  initialActiveItems: AdminAttentionItem[];
  resolvedHistory: AdminResolvedIssueHistoryRow[];
  pods: PodOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"active" | "resolved">("active");
  const [search, setSearch] = useState("");
  const [podId, setPodId] = useState("");
  const [status, setStatus] = useState<AdminAttentionReason | "all">("all");
  const [timeRange, setTimeRange] = useState<(typeof TIME_OPTIONS)[number]["value"]>("all");

  const [activeItems, setActiveItems] = useState(initialActiveItems);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [manualRecoveryTarget, setManualRecoveryTarget] = useState<{
    vendorOrderId: string;
    itemId: string;
    vendorName?: string;
  } | null>(null);
  const [manualRecoveryNote, setManualRecoveryNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const onRemoveItem = useCallback((itemId: string) => {
    setActiveItems((prev) => prev.filter((i) => i.id !== itemId));
  }, []);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const maxAge = TIME_OPTIONS.find((t) => t.value === timeRange)?.maxMinutes ?? Infinity;

  const filteredActive = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeItems.filter((item) => {
      if (item.ageMinutes > maxAge) return false;
      if (status !== "all" && item.reason !== status) return false;
      if (podId && item.order?.pod?.id !== podId) return false;
      if (!q) return true;
      const orderShort = item.orderId.toLowerCase();
      const vendor = item.vendor?.name?.toLowerCase() ?? "";
      const pod = item.order?.pod?.name?.toLowerCase() ?? "";
      return (
        orderShort.includes(q) ||
        item.orderId.toLowerCase() === q ||
        item.orderId.toLowerCase().endsWith(q) ||
        vendor.includes(q) ||
        pod.includes(q)
      );
    });
  }, [activeItems, search, podId, status, maxAge]);

  const resolvedSearch = search.trim().toLowerCase();
  const filteredResolved = useMemo(() => {
    if (!resolvedSearch) return resolvedHistory;
    return resolvedHistory.filter((r) => {
      const hay = `${r.orderId} ${r.podName ?? ""} ${r.vendorName ?? ""} ${r.type}`.toLowerCase();
      return hay.includes(resolvedSearch);
    });
  }, [resolvedHistory, resolvedSearch]);

  const [resolvedPage, setResolvedPage] = useState(0);
  const PAGE_SIZE = 40;
  const resolvedPaged = useMemo(() => {
    const start = resolvedPage * PAGE_SIZE;
    return filteredResolved.slice(start, start + PAGE_SIZE);
  }, [filteredResolved, resolvedPage]);
  const resolvedTotalPages = Math.max(1, Math.ceil(filteredResolved.length / PAGE_SIZE));

  const routingAvailable = isRoutingRetryAvailable();

  async function handleRetryRouting(vendorOrderId: string, itemId: string) {
    setActionError(null);
    setBusyId(`retry:${vendorOrderId}`);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/retry-routing`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (res.ok && data.ok === true) {
        refresh();
        onRemoveItem(itemId);
      } else {
        setActionError(data.error ?? "Retry routing failed. The item stays in the queue.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleManualRecoverySubmit() {
    if (!manualRecoveryTarget) return;
    const notes = manualRecoveryNote.trim();
    if (notes.length < 3) {
      setActionError("Add a short recovery note (what the vendor confirmed).");
      return;
    }
    setActionError(null);
    setBusyId(`manual:${manualRecoveryTarget.vendorOrderId}`);
    try {
      const res = await fetch(
        `/api/admin/vendor-orders/${manualRecoveryTarget.vendorOrderId}/manual-recovery`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        noop?: boolean;
        error?: string;
      };
      if (res.ok && data.ok === true && !data.noop) {
        onRemoveItem(manualRecoveryTarget.itemId);
        setManualRecoveryTarget(null);
        setManualRecoveryNote("");
        refresh();
      } else if (res.ok && data.noop) {
        onRemoveItem(manualRecoveryTarget.itemId);
        setManualRecoveryTarget(null);
        setManualRecoveryNote("");
        refresh();
      } else {
        setActionError(data.error ?? "Manual recovery failed. The item stays in the queue.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkIssueResolved(issueId: string, itemId: string) {
    setBusyId(`resolve:${issueId}`);
    try {
      const res = await fetch(`/api/admin/order-issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: true }),
      });
      if (res.ok) onRemoveItem(itemId);
      if (res.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleDismissLegacy(itemId: string, refundAttemptId: string) {
    setBusyId(`dismiss:${itemId}`);
    try {
      const res = await fetch(`/api/admin/refund-attempts/${refundAttemptId}/dismiss-legacy`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok !== false) onRemoveItem(itemId);
      if (res.ok) refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-oo-light-stone pb-1">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "active"
              ? "border border-b-0 border-oo-light-stone bg-oo-warm-white text-oo-charcoal"
              : "text-oo-stone-gray hover:text-oo-charcoal"
          }`}
        >
          Active issues
          {activeItems.length > 0 && (
            <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs tabular-nums text-oo-charcoal">
              {activeItems.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("resolved");
            setResolvedPage(0);
          }}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "resolved"
              ? "border border-b-0 border-oo-light-stone bg-oo-warm-white text-oo-charcoal"
              : "text-oo-stone-gray hover:text-oo-charcoal"
          }`}
        >
          Resolved
          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs tabular-nums text-oo-charcoal">
            {resolvedHistory.length}
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="issue-search" className="sr-only">
              Search
            </label>
            <input
              id="issue-search"
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setResolvedPage(0);
              }}
              placeholder="Search by order ID, vendor, or pod…"
              className="w-full rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm text-oo-charcoal placeholder:text-oo-stone-gray focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
          </div>
          {tab === "active" && (
            <div className="flex flex-wrap gap-3">
              <div>
                <label htmlFor="pod-filter" className="mb-1 block text-xs font-medium text-oo-stone-gray">
                  Pod
                </label>
                <select
                  id="pod-filter"
                  value={podId}
                  onChange={(e) => setPodId(e.target.value)}
                  className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
                >
                  <option value="">All pods</option>
                  {pods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-oo-stone-gray">
                  Type
                </label>
                <select
                  id="status-filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdminAttentionReason | "all")}
                  className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="time-filter" className="mb-1 block text-xs font-medium text-oo-stone-gray">
                  Time
                </label>
                <select
                  id="time-filter"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as (typeof TIME_OPTIONS)[number]["value"])}
                  className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-2 text-sm text-oo-charcoal"
                >
                  <option value="1h">Last 1h</option>
                  <option value="24h">Last 24h</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {tab === "active" && (
        <>
          {filteredActive.length === 0 ? (
            <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-oo-charcoal">
                {activeItems.length === 0 ? "No active issues" : "No issues match your filters"}
              </p>
              <p className="mt-1 text-sm text-oo-stone-gray">
                {activeItems.length === 0
                  ? "When something breaks routing or fulfillment, it will show up here."
                  : "Try clearing search or widening the time range."}
              </p>
              {activeItems.length === 0 && (
                <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium text-oo-charcoal underline">
                  Browse orders
                </Link>
              )}
            </div>
          ) : (
            <ul className="space-y-3">
              {filteredActive.map((item) => {
                const showRetry =
                  Boolean(item.vendorOrderId) &&
                  routingAvailable &&
                  item.canRetryRouting === true;
                const showManualRecovery =
                  Boolean(item.vendorOrderId) && item.canManualRecover === true;
                const showMarkResolved =
                  item.reason === "open_issue" && item.issueId && item.scope === "order";
                const refundId = getRefundAttemptIdFromItemId(item.id);

                return (
                  <li
                    key={item.id}
                    className={`overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm ${borderClass(item.severity)}`}
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <Link
                            href={`/admin/orders/${item.orderId}`}
                            className="font-mono text-sm font-semibold text-oo-charcoal hover:underline"
                          >
                            #{item.orderId.slice(-8).toUpperCase()}
                          </Link>
                          {item.order?.pod?.name && (
                            <span className="text-sm text-oo-stone-gray">{item.order.pod.name}</span>
                          )}
                          <span className="text-sm text-oo-stone-gray" title={`~${item.ageMinutes} min since reference`}>
                            {formatRelativeFromAgeMinutes(item.ageMinutes)}
                          </span>
                        </div>
                        <h2 className="text-base font-semibold text-oo-charcoal">{issueTitle(item.reason)}</h2>
                        <p className="text-sm leading-snug text-oo-stone-gray">{oneLine(item.reasonLabel)}</p>
                        {item.vendor?.name && (
                          <p className="text-xs text-oo-stone-gray">{item.vendor.name}</p>
                        )}
                        {item.vendorOrderId && (
                          <dl className="mt-2 grid gap-1 text-xs text-oo-stone-gray sm:grid-cols-2">
                            {item.paymentLabel && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Payment</dt>
                                <dd>{item.paymentLabel}</dd>
                              </>
                            )}
                            {item.orderStatus && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Parent order</dt>
                                <dd className="font-mono">{item.orderStatus}</dd>
                              </>
                            )}
                            {item.vendorOrderRoutingStatus && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Routing</dt>
                                <dd className="font-mono">{item.vendorOrderRoutingStatus}</dd>
                              </>
                            )}
                            {item.vendorOrderFulfillmentStatus && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Fulfillment</dt>
                                <dd className="font-mono">{item.vendorOrderFulfillmentStatus}</dd>
                              </>
                            )}
                            {item.deliverectAttempts != null && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Deliverect attempts</dt>
                                <dd>{item.deliverectAttempts}</dd>
                              </>
                            )}
                            {item.deliverectSubmittedAt && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Last submit</dt>
                                <dd>{new Date(item.deliverectSubmittedAt).toLocaleString()}</dd>
                              </>
                            )}
                            {item.order?.customerPhone && (
                              <>
                                <dt className="font-medium text-oo-charcoal">Customer phone</dt>
                                <dd>{item.order.customerPhone}</dd>
                              </>
                            )}
                          </dl>
                        )}
                        {item.manualRecoveryNotes && (
                          <p className="text-xs text-emerald-800">
                            Recovery note: {oneLine(item.manualRecoveryNotes, 200)}
                          </p>
                        )}
                        {item.deliverectGuidance || item.deliverectDiagnostic ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-oo-stone-gray hover:text-oo-charcoal">
                              POS / routing details
                            </summary>
                            {item.deliverectGuidance && (
                              <div className="mt-2 rounded-md border border-oo-light-stone bg-oo-cream px-3 py-2 text-oo-charcoal">
                                <p className="font-medium">{item.deliverectGuidance.recommendedAction}</p>
                                <p className="mt-1 text-xs text-oo-stone-gray">{item.deliverectGuidance.stateSummary}</p>
                              </div>
                            )}
                            {item.deliverectDiagnostic && (
                              <p className="mt-2 text-xs text-oo-stone-gray">{item.deliverectDiagnostic}</p>
                            )}
                          </details>
                        ) : null}
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-oo-light-stone pt-3 sm:border-t-0 sm:pt-0">
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                        >
                          View order
                        </Link>
                        {showRetry && item.vendorOrderId && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => void handleRetryRouting(item.vendorOrderId!, item.id)}
                            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                          >
                            {busyId === `retry:${item.vendorOrderId}` ? "…" : "Retry routing"}
                          </button>
                        )}
                        {showManualRecovery && item.vendorOrderId && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => {
                              setActionError(null);
                              setManualRecoveryNote("");
                              setManualRecoveryTarget({
                                vendorOrderId: item.vendorOrderId!,
                                itemId: item.id,
                                vendorName: item.vendor?.name,
                              });
                            }}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Mark manually received
                          </button>
                        )}
                        {showMarkResolved && item.issueId && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleMarkIssueResolved(item.issueId!, item.id)}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {busyId === `resolve:${item.issueId}` ? "…" : "Mark resolved"}
                          </button>
                        )}
                        {item.reason === "refund_failed" && refundId && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleDismissLegacy(item.id, refundId)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50"
                          >
                            {busyId === `dismiss:${item.id}` ? "…" : "Dismiss (legacy)"}
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {actionError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800" role="alert">
              {actionError}
            </p>
          )}
        </>
      )}

      {manualRecoveryTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-labelledby="manual-recovery-title"
        >
          <div className="w-full max-w-md rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-lg">
            <h2 id="manual-recovery-title" className="text-lg font-semibold text-oo-charcoal">
              Mark manually received
            </h2>
            <p className="mt-1 text-sm text-oo-stone-gray">
              {manualRecoveryTarget.vendorName
                ? `${manualRecoveryTarget.vendorName} confirmed they have this order outside Deliverect/POS sync.`
                : "Confirm the vendor has the order before continuing."}{" "}
              Fulfillment will move to accepted; routing history is preserved for audit.
            </p>
            <label className="mt-4 block text-sm font-medium text-oo-charcoal" htmlFor="recovery-note">
              Recovery note
            </label>
            <textarea
              id="recovery-note"
              rows={3}
              value={manualRecoveryNote}
              onChange={(e) => setManualRecoveryNote(e.target.value)}
              placeholder="e.g. Vendor confirmed by phone at 2:15pm — order on grill"
              className="mt-1 w-full rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-oo-light-stone px-3 py-2 text-sm"
                disabled={busyId !== null}
                onClick={() => {
                  setManualRecoveryTarget(null);
                  setManualRecoveryNote("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                disabled={busyId !== null}
                onClick={() => void handleManualRecoverySubmit()}
              >
                {busyId === `manual:${manualRecoveryTarget.vendorOrderId}` ? "…" : "Confirm recovery"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "resolved" && (
        <div className="space-y-4">
          {resolvedPaged.length === 0 ? (
            <p className="rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/80 px-4 py-8 text-center text-sm text-oo-stone-gray">
              {resolvedHistory.length === 0
                ? "No resolved issue records yet (tracked issues appear here after you resolve them on an order)."
                : "No results for this search."}
            </p>
          ) : (
            <ul className="divide-y divide-oo-light-stone rounded-lg border border-oo-light-stone bg-oo-warm-white">
              {resolvedPaged.map((r) => (
                <li key={`${r.kind}:${r.id}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-oo-charcoal">{humanizeIssueType(r.type)}</p>
                    <p className="mt-0.5 text-xs text-oo-stone-gray">
                      <span className="font-mono text-oo-charcoal">#{r.orderId.slice(-8).toUpperCase()}</span>
                      {r.podName && <> · {r.podName}</>}
                      {r.vendorName && <> · {r.vendorName}</>}
                    </p>
                    {r.notes && <p className="mt-1 line-clamp-1 text-xs text-oo-stone-gray">{r.notes}</p>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-oo-stone-gray">
                    <span>Resolved {formatResolvedAgo(r.resolvedAt)}</span>
                    <Link href={`/admin/orders/${r.orderId}`} className="font-medium text-oo-charcoal underline">
                      View order
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {resolvedTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-oo-stone-gray">
              <button
                type="button"
                disabled={resolvedPage <= 0}
                onClick={() => setResolvedPage((p) => Math.max(0, p - 1))}
                className="rounded border border-oo-light-stone bg-oo-warm-white px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {resolvedPage + 1} of {resolvedTotalPages}
              </span>
              <button
                type="button"
                disabled={resolvedPage >= resolvedTotalPages - 1}
                onClick={() => setResolvedPage((p) => Math.min(resolvedTotalPages - 1, p + 1))}
                className="rounded border border-oo-light-stone bg-oo-warm-white px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
