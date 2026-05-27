"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  customerSupportIssueTypeLabel,
  isActiveOrderIssueStatus,
} from "@/domain/order-support-issue";

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
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type VendorOrderIssueRow = SystemIssueRow & {
  vendorOrderId: string;
  vendorName: string;
};

type OrderRefundLinkOption = { id: string; label: string };

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function humanizeType(type: string): string {
  return customerSupportIssueTypeLabel(type) || type.replace(/_/g, " ");
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "open" || s === "open") return "bg-amber-100 text-amber-900";
  if (s === "reviewing") return "bg-blue-100 text-blue-900";
  if (s === "resolved") return "bg-emerald-100 text-emerald-900";
  if (s === "dismissed") return "bg-stone-200 text-stone-700";
  return "bg-stone-200 text-stone-800";
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
}: {
  orderId: string;
  customerSupportIssues: CustomerSupportIssueRow[];
  systemOrderIssues: SystemIssueRow[];
  vendorOrderIssues: VendorOrderIssueRow[];
  orderRefundOptions: OrderRefundLinkOption[];
  initialResolutionNotes: string | null;
  canExecuteRefunds?: boolean;
  onRefundFromIssue?: (issue: CustomerSupportIssueRow) => void;
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

  const systemAll = [
    ...systemOrderIssues.map((i) => ({ ...i, kind: "order" as const })),
    ...vendorOrderIssues.map((i) => ({ ...i, kind: "vendor" as const })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <section
      id="order-issues"
      className="scroll-mt-4 rounded-lg border border-amber-200/80 bg-amber-50/40 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-oo-charcoal">Order issues</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Customer reports and system flags. Refunds are issued separately in{" "}
            <Link href="#payments-refunds" className="font-medium text-oo-charcoal underline">
              Payments &amp; Refunds
            </Link>
            .
          </p>
        </div>
      </div>

      {customerSupportIssues.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-oo-charcoal">Customer reports</h3>
          <ul className="mt-2 space-y-3">
            {customerSupportIssues.map((issue) => {
              const active = isActiveOrderIssueStatus(issue.status);
              return (
                <li
                  key={issue.id}
                  className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-3 text-sm shadow-sm"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-semibold text-oo-charcoal">
                      {humanizeType(issue.issueType)}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${statusBadgeClass(issue.status)}`}>
                      {issue.status}
                    </span>
                    {issue.priority && (
                      <span className="text-xs text-oo-stone-gray">Priority: {issue.priority}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-oo-stone-gray">
                    {formatDate(new Date(issue.createdAt))}
                    {issue.vendorName && ` · ${issue.vendorName}`}
                    {issue.lineItemName && ` · ${issue.lineItemName}`}
                  </p>
                  {issue.customerMessage && (
                    <p className="mt-2 rounded border border-oo-light-stone bg-white/80 px-2 py-1.5 text-oo-charcoal">
                      <span className="text-xs font-medium text-oo-stone-gray">Customer: </span>
                      {issue.customerMessage}
                    </p>
                  )}
                  {issue.linkedOrderRefundId && (
                    <p className="mt-2 text-xs text-oo-stone-gray">
                      Linked refund: {issue.linkedRefundStatus ?? "—"}
                      {issue.linkedRefundAmountCents != null &&
                        ` · $${(issue.linkedRefundAmountCents / 100).toFixed(2)}`}
                    </p>
                  )}
                  <label className="mt-2 block text-xs font-medium text-oo-stone-gray">
                    Internal note
                  </label>
                  <textarea
                    className="mt-1 w-full min-h-[60px] rounded border border-oo-light-stone bg-white px-2 py-1 text-sm"
                    value={draftNotes[issue.id] ?? ""}
                    onChange={(e) =>
                      setDraftNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))
                    }
                  />
                  {orderRefundOptions.length > 0 && (
                    <div className="mt-2">
                      <label className="text-xs font-medium text-oo-stone-gray">
                        Link refund (optional)
                      </label>
                      <select
                        className="mt-1 w-full rounded border border-oo-light-stone bg-white px-2 py-1 text-xs"
                        value={issue.linkedOrderRefundId ?? ""}
                        onChange={(e) =>
                          void patchIssue(issue.id, {
                            linkedOrderRefundId: e.target.value || null,
                          })
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
                  {active && (
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
                        onClick={() =>
                          void patchIssue(issue.id, {
                            internalNote: draftNotes[issue.id] ?? null,
                          })
                        }
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
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {customerSupportIssues.length === 0 && (
        <p className="mt-4 text-sm text-oo-stone-gray">No customer-reported issues for this order.</p>
      )}

      {systemAll.length > 0 && (
        <div className="mt-6 border-t border-amber-200/80 pt-4">
          <h3 className="text-sm font-semibold text-oo-charcoal">System / operational issues</h3>
          <ul className="mt-2 space-y-3">
            {systemAll.map((issue) => (
              <li
                key={issue.id}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="font-semibold capitalize text-oo-charcoal">
                    {humanizeType(issue.type)}
                  </span>
                  <span className="text-xs text-oo-stone-gray">
                    {"vendorName" in issue ? issue.vendorName : "Order-wide"}
                  </span>
                  <span className="text-xs">{issue.status}</span>
                </div>
                <p className="mt-2 text-oo-charcoal">
                  {issue.notes?.trim() || `${humanizeType(issue.type)} — ${issue.status.toLowerCase()}`}
                </p>
                {(issue.status === "OPEN" || issue.status === "open") && (
                  <button
                    type="button"
                    onClick={() => void handleResolveSystem(issue.kind, issue.id)}
                    disabled={busyId === issue.id}
                    className="mt-3 rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-hover disabled:opacity-50"
                  >
                    Mark resolved
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 border-t border-amber-200/80 pt-4">
        <label htmlFor="admin-resolution-notes" className="block text-sm font-medium text-oo-charcoal">
          Resolution notes (order-wide)
        </label>
        <textarea
          id="admin-resolution-notes"
          className="mt-2 w-full min-h-[100px] rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm"
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveResolutionNotes()}
            disabled={savingNotes}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
          {notesMessage && <span className="text-sm text-oo-stone-gray">{notesMessage}</span>}
        </div>
      </div>
    </section>
  );
}
