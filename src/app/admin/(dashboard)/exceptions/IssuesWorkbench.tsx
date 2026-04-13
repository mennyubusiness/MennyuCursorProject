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
  { value: "manual_recovery_required", label: "Manual recovery" },
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
    case "manual_recovery_required":
      return "Manual recovery required";
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

  async function handleRetryRouting(vendorOrderId: string) {
    setBusyId(`retry:${vendorOrderId}`);
    try {
      const res = await fetch(`/api/admin/vendor-orders/${vendorOrderId}/retry-routing`, { method: "POST" });
      if (res.ok) {
        refresh();
        setActiveItems((prev) => prev.filter((i) => i.vendorOrderId !== vendorOrderId));
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
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-1">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "active"
              ? "border border-b-0 border-stone-200 bg-white text-stone-900"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          Active issues
          {activeItems.length > 0 && (
            <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs tabular-nums text-stone-800">
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
              ? "border border-b-0 border-stone-200 bg-white text-stone-900"
              : "text-stone-600 hover:text-stone-900"
          }`}
        >
          Resolved
          <span className="ml-2 rounded-full bg-stone-200 px-2 py-0.5 text-xs tabular-nums text-stone-800">
            {resolvedHistory.length}
          </span>
        </button>
      </div>

      <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4">
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
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
            />
          </div>
          {tab === "active" && (
            <div className="flex flex-wrap gap-3">
              <div>
                <label htmlFor="pod-filter" className="mb-1 block text-xs font-medium text-stone-500">
                  Pod
                </label>
                <select
                  id="pod-filter"
                  value={podId}
                  onChange={(e) => setPodId(e.target.value)}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800"
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
                <label htmlFor="status-filter" className="mb-1 block text-xs font-medium text-stone-500">
                  Type
                </label>
                <select
                  id="status-filter"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as AdminAttentionReason | "all")}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="time-filter" className="mb-1 block text-xs font-medium text-stone-500">
                  Time
                </label>
                <select
                  id="time-filter"
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value as (typeof TIME_OPTIONS)[number]["value"])}
                  className="rounded-lg border border-stone-300 bg-white px-2 py-2 text-sm text-stone-800"
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
            <div className="rounded-xl border border-stone-200 bg-white px-6 py-12 text-center">
              <p className="text-sm font-medium text-stone-700">
                {activeItems.length === 0 ? "No active issues" : "No issues match your filters"}
              </p>
              <p className="mt-1 text-sm text-stone-500">
                {activeItems.length === 0
                  ? "When something breaks routing or fulfillment, it will show up here."
                  : "Try clearing search or widening the time range."}
              </p>
              {activeItems.length === 0 && (
                <Link href="/admin/orders" className="mt-4 inline-block text-sm font-medium text-stone-700 underline">
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
                  item.recommendedAction === "retry_routing";
                const showMarkResolved =
                  item.reason === "open_issue" && item.issueId && item.scope === "order";
                const refundId = getRefundAttemptIdFromItemId(item.id);

                return (
                  <li
                    key={item.id}
                    className={`overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm ${borderClass(item.severity)}`}
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <Link
                            href={`/admin/orders/${item.orderId}`}
                            className="font-mono text-sm font-semibold text-stone-900 hover:underline"
                          >
                            #{item.orderId.slice(-8).toUpperCase()}
                          </Link>
                          {item.order?.pod?.name && (
                            <span className="text-sm text-stone-600">{item.order.pod.name}</span>
                          )}
                          <span className="text-sm text-stone-400" title={`~${item.ageMinutes} min since reference`}>
                            {formatRelativeFromAgeMinutes(item.ageMinutes)}
                          </span>
                        </div>
                        <h2 className="text-base font-semibold text-stone-900">{issueTitle(item.reason)}</h2>
                        <p className="text-sm leading-snug text-stone-600">{oneLine(item.reasonLabel)}</p>
                        {item.vendor?.name && (
                          <p className="text-xs text-stone-500">{item.vendor.name}</p>
                        )}
                        {item.deliverectGuidance || item.deliverectDiagnostic ? (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-stone-500 hover:text-stone-700">
                              POS / routing details
                            </summary>
                            {item.deliverectGuidance && (
                              <div className="mt-2 rounded-md border border-stone-100 bg-stone-50 px-3 py-2 text-stone-800">
                                <p className="font-medium">{item.deliverectGuidance.recommendedAction}</p>
                                <p className="mt-1 text-xs text-stone-600">{item.deliverectGuidance.stateSummary}</p>
                              </div>
                            )}
                            {item.deliverectDiagnostic && (
                              <p className="mt-2 text-xs text-stone-600">{item.deliverectDiagnostic}</p>
                            )}
                          </details>
                        ) : null}
                      </div>
                      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-t border-stone-100 pt-3 sm:border-t-0 sm:pt-0">
                        <Link
                          href={`/admin/orders/${item.orderId}`}
                          className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
                        >
                          View order
                        </Link>
                        {showRetry && item.vendorOrderId && (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleRetryRouting(item.vendorOrderId!)}
                            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
                          >
                            {busyId === `retry:${item.vendorOrderId}` ? "…" : "Retry routing"}
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
        </>
      )}

      {tab === "resolved" && (
        <div className="space-y-4">
          {resolvedPaged.length === 0 ? (
            <p className="rounded-lg border border-dashed border-stone-200 bg-stone-50/80 px-4 py-8 text-center text-sm text-stone-600">
              {resolvedHistory.length === 0
                ? "No resolved issue records yet (tracked issues appear here after you resolve them on an order)."
                : "No results for this search."}
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
              {resolvedPaged.map((r) => (
                <li key={`${r.kind}:${r.id}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800">{humanizeIssueType(r.type)}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      <span className="font-mono text-stone-700">#{r.orderId.slice(-8).toUpperCase()}</span>
                      {r.podName && <> · {r.podName}</>}
                      {r.vendorName && <> · {r.vendorName}</>}
                    </p>
                    {r.notes && <p className="mt-1 line-clamp-1 text-xs text-stone-500">{r.notes}</p>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-stone-500">
                    <span>Resolved {formatResolvedAgo(r.resolvedAt)}</span>
                    <Link href={`/admin/orders/${r.orderId}`} className="font-medium text-stone-700 underline">
                      View order
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {resolvedTotalPages > 1 && (
            <div className="flex items-center justify-center gap-3 text-sm text-stone-600">
              <button
                type="button"
                disabled={resolvedPage <= 0}
                onClick={() => setResolvedPage((p) => Math.max(0, p - 1))}
                className="rounded border border-stone-300 bg-white px-3 py-1 disabled:opacity-40"
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
                className="rounded border border-stone-300 bg-white px-3 py-1 disabled:opacity-40"
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
