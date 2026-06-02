"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  customerSupportIssueTypeLabel,
  isActiveOrderIssueStatus,
} from "@/domain/order-support-issue";
import { vendorIssueStatusLabel } from "@/domain/vendor-order-issue";
import type { ExceptionType } from "@/lib/admin-exceptions";
import {
  ADMIN_SECTION_CARD,
  formatAdminOrderDate,
  isSystemIssueActive,
  issueStatusBadgeClass,
  severityBadgeClass,
} from "@/lib/admin-order-detail-ui";
import { AdminVendorOrderExceptionActions } from "./AdminVendorOrderExceptionActions";

type SystemIssueRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type CustomerSupportIssueRow = {
  id: string;
  issueType: string;
  status: string;
  priority: string | null;
  vendorOrderId: string | null;
  vendorName: string | null;
  orderLineItemId: string | null;
  lineItemName: string | null;
  customerMessage: string | null;
  internalNote: string | null;
  linkedOrderRefundId: string | null;
  linkedRefundStatus: string | null;
  linkedRefundAmountCents: number | null;
  vendorResponse: string | null;
  vendorRespondedAt: string | null;
  vendorIssueStatus: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type VendorOrderIssueRow = SystemIssueRow & {
  vendorOrderId: string;
  vendorName: string;
};

type OrderRefundLinkOption = { id: string; label: string };

export type VendorRecoveryContext = {
  vendorOrderId: string;
  vendorId: string;
  vendorName: string;
  exceptionType: ExceptionType;
  reason: string | null;
  fulfillmentStatus: string;
  hasExceptionAction: boolean;
  canCancel: boolean;
};

function humanizeType(type: string): string {
  return customerSupportIssueTypeLabel(type) || type.replace(/_/g, " ");
}

function systemRecommendedAction(type: string): string {
  if (type === "routing_failure") return "Retry routing or mark manually received after vendor confirms.";
  if (type.includes("routing")) return "Review routing state and retry or recover manually.";
  return "Review and resolve when handled.";
}

export function AdminOrderIssuesPanel({
  orderId,
  customerSupportIssues,
  systemOrderIssues,
  vendorOrderIssues,
  orderRefundOptions,
  initialResolutionNotes,
  canExecuteRefunds,
  onRefundFromIssue,
  vendorRecoveryContexts = [],
  routingAvailable = false,
}: {
  orderId: string;
  customerSupportIssues: CustomerSupportIssueRow[];
  systemOrderIssues: SystemIssueRow[];
  vendorOrderIssues: VendorOrderIssueRow[];
  orderRefundOptions: OrderRefundLinkOption[];
  initialResolutionNotes: string | null;
  canExecuteRefunds?: boolean;
  onRefundFromIssue?: (issue: CustomerSupportIssueRow) => void;
  vendorRecoveryContexts?: VendorRecoveryContext[];
  routingAvailable?: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState(initialResolutionNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const i of customerSupportIssues) {
      next[i.id] = i.internalNote ?? "";
    }
    setDraftNotes(next);
  }, [customerSupportIssues]);

  async function patchIssue(issueId: string, body: Record<string, unknown>) {
    setBusyId(issueId);
    try {
      const res = await fetch(`/api/admin/order-issues/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveSystem(kind: "order" | "vendor", issueId: string) {
    setBusyId(issueId);
    try {
      const base = kind === "order" ? "/api/admin/order-issues" : "/api/admin/vendor-order-issues";
      const res = await fetch(`${base}/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function handleSaveResolutionNotes() {
    setNotesMessage(null);
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/resolution-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: resolutionNotes.trim() || null }),
      });
      if (res.ok) {
        setNotesMessage("Saved.");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setNotesMessage(data.error ?? "Could not save");
      }
    } finally {
      setSavingNotes(false);
    }
  }

  const systemAll = useMemo(
    () =>
      [
        ...systemOrderIssues.map((i) => ({ ...i, kind: "order" as const })),
        ...vendorOrderIssues.map((i) => ({ ...i, kind: "vendor" as const })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [systemOrderIssues, vendorOrderIssues]
  );

  const activeCustomerIssues = customerSupportIssues.filter((i) => isActiveOrderIssueStatus(i.status));
  const resolvedCustomerIssues = customerSupportIssues.filter((i) => !isActiveOrderIssueStatus(i.status));
  const activeSystemIssues = systemAll.filter((i) => isSystemIssueActive(i.status));
  const resolvedSystemIssues = systemAll.filter((i) => !isSystemIssueActive(i.status));

  const activeRecoveryContexts = vendorRecoveryContexts.filter((c) => c.hasExceptionAction);
  const hasActiveWork =
    activeCustomerIssues.length > 0 ||
    activeSystemIssues.length > 0 ||
    activeRecoveryContexts.length > 0;

  const recoveryByVendorOrderId = new Map(
    activeRecoveryContexts.map((c) => [c.vendorOrderId, c] as const)
  );

  function renderCustomerIssue(issue: CustomerSupportIssueRow, active: boolean) {
    return (
      <li
        key={issue.id}
        className={`rounded-lg border p-3 text-sm ${
          active
            ? "border-amber-300 bg-oo-warm-white shadow-sm"
            : "border-oo-light-stone/80 bg-oo-cream/30"
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold text-oo-charcoal">{humanizeType(issue.issueType)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${issueStatusBadgeClass(issue.status)}`}>
            {issue.status}
          </span>
          {issue.priority && (
            <span className="text-xs text-oo-stone-gray">Priority: {issue.priority}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-oo-stone-gray">
          {formatAdminOrderDate(new Date(issue.createdAt))}
          {issue.vendorName && ` · ${issue.vendorName}`}
          {issue.lineItemName && ` · ${issue.lineItemName}`}
        </p>
        {issue.customerMessage && (
          <p className="mt-2 rounded border border-oo-light-stone bg-white/80 px-2 py-1.5 text-oo-charcoal">
            <span className="text-xs font-medium text-oo-stone-gray">Customer: </span>
            {issue.customerMessage}
          </p>
        )}
        {(issue.vendorResponse || issue.vendorIssueStatus) && (
          <div className="mt-2 rounded border border-blue-200 bg-blue-50/70 px-2 py-1.5 text-xs text-blue-950">
            <p className="font-medium">
              Vendor: {vendorIssueStatusLabel(issue.vendorIssueStatus)}
              {issue.vendorRespondedAt && ` · ${formatAdminOrderDate(new Date(issue.vendorRespondedAt))}`}
            </p>
            {issue.vendorResponse && <p className="mt-1 whitespace-pre-wrap">{issue.vendorResponse}</p>}
          </div>
        )}
        {issue.linkedOrderRefundId && (
          <p className="mt-2 text-xs text-oo-stone-gray">
            Linked refund: {issue.linkedRefundStatus ?? "—"}
            {issue.linkedRefundAmountCents != null &&
              ` · $${(issue.linkedRefundAmountCents / 100).toFixed(2)}`}
          </p>
        )}
        {active && (
          <>
            <label className="mt-2 block text-xs font-medium text-oo-stone-gray">Internal note</label>
            <textarea
              className="mt-1 w-full min-h-[56px] rounded border border-oo-light-stone bg-white px-2 py-1 text-sm"
              value={draftNotes[issue.id] ?? ""}
              onChange={(e) => setDraftNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))}
            />
            {orderRefundOptions.length > 0 && (
              <div className="mt-2">
                <label className="text-xs font-medium text-oo-stone-gray">Link refund (optional)</label>
                <select
                  className="mt-1 w-full rounded border border-oo-light-stone bg-white px-2 py-1 text-xs"
                  value={issue.linkedOrderRefundId ?? ""}
                  onChange={(e) =>
                    void patchIssue(issue.id, { linkedOrderRefundId: e.target.value || null })
                  }
                  disabled={busyId === issue.id}
                >
                  <option value="">None</option>
                  {orderRefundOptions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {canExecuteRefunds && onRefundFromIssue && (
                <button
                  type="button"
                  disabled={busyId === issue.id}
                  onClick={() => onRefundFromIssue(issue)}
                  className="rounded-md border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-medium text-oo-charcoal hover:bg-brand/20 disabled:opacity-50"
                >
                  Refund from this issue
                </button>
              )}
              <button
                type="button"
                disabled={busyId === issue.id}
                onClick={() => void patchIssue(issue.id, { internalNote: draftNotes[issue.id] ?? null })}
                className="rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium hover:bg-oo-cream/80 disabled:opacity-50"
              >
                Save note
              </button>
              {issue.status !== "reviewing" && issue.status !== "OPEN" && (
                <button
                  type="button"
                  disabled={busyId === issue.id}
                  onClick={() => void patchIssue(issue.id, { reviewing: true })}
                  className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 disabled:opacity-50"
                >
                  Mark reviewing
                </button>
              )}
              <button
                type="button"
                disabled={busyId === issue.id}
                onClick={() => void patchIssue(issue.id, { resolve: true })}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                Resolve
              </button>
              <button
                type="button"
                disabled={busyId === issue.id}
                onClick={() => void patchIssue(issue.id, { dismiss: true })}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Dismiss
              </button>
            </div>
          </>
        )}
      </li>
    );
  }

  function renderSystemIssue(
    issue: (typeof systemAll)[number],
    active: boolean
  ) {
    const recovery =
      issue.kind === "vendor" && "vendorOrderId" in issue
        ? recoveryByVendorOrderId.get(issue.vendorOrderId)
        : undefined;

    return (
      <li
        key={issue.id}
        className={`rounded-lg border p-3 text-sm ${
          active
            ? "border-red-200 bg-oo-warm-white shadow-sm"
            : "border-oo-light-stone/80 bg-oo-cream/30"
        }`}
      >
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-semibold capitalize text-oo-charcoal">{humanizeType(issue.type)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${issueStatusBadgeClass(issue.status)}`}>
            {active ? "Open" : "Resolved"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityBadgeClass(issue.severity)}`}>
            {issue.severity}
          </span>
          {"vendorName" in issue && (
            <span className="text-xs font-medium text-oo-charcoal">{issue.vendorName}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-oo-stone-gray">{formatAdminOrderDate(new Date(issue.createdAt))}</p>
        <p className="mt-2 text-oo-charcoal">
          {issue.notes?.trim() || `${humanizeType(issue.type)} — ${issue.status.toLowerCase()}`}
        </p>
        {active && (
          <p className="mt-1 text-xs text-oo-stone-gray">{systemRecommendedAction(issue.type)}</p>
        )}
        {active && recovery && (
          <div className="mt-3 border-t border-oo-light-stone pt-3">
            <AdminVendorOrderExceptionActions
              vendorOrderId={recovery.vendorOrderId}
              exceptionType={recovery.exceptionType}
              fulfillmentStatus={recovery.fulfillmentStatus}
              routingAvailable={routingAvailable}
              canCancel={recovery.canCancel}
            />
            <Link
              href={`#vendor-order-${recovery.vendorOrderId}`}
              className="mt-2 inline-block text-xs text-oo-stone-gray underline hover:text-oo-charcoal"
            >
              View vendor order ↓
            </Link>
          </div>
        )}
        {active && !recovery && (
          <button
            type="button"
            onClick={() => void handleResolveSystem(issue.kind, issue.id)}
            disabled={busyId === issue.id}
            className="mt-3 rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium hover:bg-oo-cream/80 disabled:opacity-50"
          >
            Mark resolved
          </button>
        )}
      </li>
    );
  }

  const sectionClass = hasActiveWork
    ? "scroll-mt-4 rounded-xl border-2 border-amber-300/70 bg-amber-50/30 p-5 shadow-sm"
    : `${ADMIN_SECTION_CARD} scroll-mt-4 py-4`;

  return (
    <section id="order-issues" className={sectionClass}>
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
          Action needed
        </h2>
        {hasActiveWork ? (
          <p className="mt-1 text-sm text-oo-charcoal">
            Resolve routing failures and customer reports. Refunds are in{" "}
            <Link href="#payments-refunds" className="underline">
              Payments &amp; Refunds
            </Link>
            .
          </p>
        ) : (
          <p className="mt-1 text-xs text-oo-stone-gray">No open issues — order is operating normally.</p>
        )}
      </div>

      {hasActiveWork && (
        <ul className="mt-4 space-y-3">
          {activeSystemIssues.map((issue) => renderSystemIssue(issue, true))}
          {activeRecoveryContexts
            .filter((c) => !activeSystemIssues.some((i) => i.kind === "vendor" && "vendorOrderId" in i && i.vendorOrderId === c.vendorOrderId))
            .map((c) => (
              <li
                key={c.vendorOrderId}
                className="rounded-lg border border-red-200 bg-oo-warm-white p-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-semibold text-oo-charcoal">{c.vendorName}</span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">
                    {c.exceptionType.replace(/_/g, " ")}
                  </span>
                </div>
                {c.reason && <p className="mt-2 text-sm text-red-900">{c.reason}</p>}
                <div className="mt-3">
                  <AdminVendorOrderExceptionActions
                    vendorOrderId={c.vendorOrderId}
                    exceptionType={c.exceptionType}
                    fulfillmentStatus={c.fulfillmentStatus}
                    routingAvailable={routingAvailable}
                    canCancel={c.canCancel}
                  />
                </div>
              </li>
            ))}
          {activeCustomerIssues.map((issue) => renderCustomerIssue(issue, true))}
        </ul>
      )}

      {(resolvedCustomerIssues.length > 0 || resolvedSystemIssues.length > 0) && (
        <details className="mt-4 rounded-lg border border-oo-light-stone/80 bg-oo-cream/20 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-oo-stone-gray hover:text-oo-charcoal">
            Resolved system issues ({resolvedSystemIssues.length + resolvedCustomerIssues.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {resolvedSystemIssues.map((issue) => renderSystemIssue(issue, false))}
            {resolvedCustomerIssues.map((issue) => renderCustomerIssue(issue, false))}
          </ul>
        </details>
      )}

      <details className="mt-4 rounded-lg border border-oo-light-stone/60 bg-oo-warm-white/50 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-oo-stone-gray hover:text-oo-charcoal">
          Order resolution notes
        </summary>
        <textarea
          id="admin-resolution-notes"
          className="mt-2 w-full min-h-[80px] rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveResolutionNotes()}
            disabled={savingNotes}
            className="rounded-md border border-oo-light-stone bg-white px-3 py-1.5 text-xs font-medium hover:bg-oo-cream/80 disabled:opacity-50"
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
          {notesMessage && <span className="text-xs text-oo-stone-gray">{notesMessage}</span>}
        </div>
      </details>
    </section>
  );
}
