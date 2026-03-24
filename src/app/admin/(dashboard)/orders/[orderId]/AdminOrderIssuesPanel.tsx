"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type OrderIssueRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
};

type VendorOrderIssueRow = OrderIssueRow & {
  vendorOrderId: string;
  vendorName: string;
};

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function humanizeType(type: string): string {
  return type.replace(/_/g, " ");
}

export function AdminOrderIssuesPanel({
  orderId,
  orderIssues,
  vendorOrderIssues,
  initialResolutionNotes,
}: {
  orderId: string;
  orderIssues: OrderIssueRow[];
  vendorOrderIssues: VendorOrderIssueRow[];
  initialResolutionNotes: string | null;
}) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState(initialResolutionNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);

  const allOrderIssues = orderIssues.map((i) => ({ ...i, kind: "order" as const }));
  const allVoIssues = vendorOrderIssues.map((i) => ({ ...i, kind: "vendor" as const }));
  const all = [...allOrderIssues, ...allVoIssues].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  async function handleResolve(kind: "order" | "vendor", issueId: string) {
    setResolvingId(issueId);
    try {
      const base = kind === "order" ? "/api/admin/order-issues" : "/api/admin/vendor-order-issues";
      const res = await fetch(`${base}/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolve: true }),
      });
      if (res.ok) router.refresh();
    } finally {
      setResolvingId(null);
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

  return (
    <section className="rounded-lg border border-amber-200/80 bg-amber-50/40 p-4">
      <h2 className="text-lg font-semibold text-stone-900">⚠ Issues</h2>
      <p className="mt-1 text-sm text-stone-600">
        Open problems on this order. Use{" "}
        <span className="font-medium text-stone-800">Resolution notes</span> below for a single shared
        log (not per-issue).
      </p>

      {all.length === 0 ? (
        <p className="mt-4 text-sm text-stone-600">No issues recorded for this order.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {all.map((issue) => (
            <li
              key={issue.id}
              className="rounded-lg border border-stone-200 bg-white p-3 text-sm shadow-sm"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-semibold capitalize text-stone-900">
                  {humanizeType(issue.type)}
                </span>
                <span className="text-xs text-stone-500">
                  {"vendorName" in issue ? issue.vendorName : "Order-wide"}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    issue.severity === "HIGH"
                      ? "bg-red-100 text-red-800"
                      : issue.severity === "MEDIUM"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {issue.severity}
                </span>
                <span
                  className={
                    issue.status === "RESOLVED" ? "text-xs text-stone-500" : "text-xs font-medium text-stone-800"
                  }
                >
                  {issue.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-stone-500">
                {formatDate(new Date(issue.createdAt))}
                {issue.resolvedAt && ` · Resolved ${formatDate(new Date(issue.resolvedAt))}`}
              </p>
              <p className="mt-2 text-stone-700">
                {issue.notes?.trim() || `${humanizeType(issue.type)} — ${issue.status.toLowerCase()}`}
              </p>
              {issue.status === "OPEN" && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => handleResolve(issue.kind, issue.id)}
                    disabled={resolvingId === issue.id}
                    className="rounded-md bg-stone-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-900 disabled:opacity-50"
                  >
                    {resolvingId === issue.id ? "…" : "Mark issue resolved"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 border-t border-amber-200/80 pt-4">
        <label htmlFor="admin-resolution-notes" className="block text-sm font-medium text-stone-800">
          Resolution notes
        </label>
        <p className="mt-0.5 text-xs text-stone-500">
          One place for how this order was handled; visible to admins on refresh.
        </p>
        <textarea
          id="admin-resolution-notes"
          className="mt-2 w-full min-h-[100px] rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 shadow-sm focus:border-stone-500 focus:outline-none focus:ring-1 focus:ring-stone-400"
          value={resolutionNotes}
          onChange={(e) => setResolutionNotes(e.target.value)}
          placeholder="What went wrong, what you did, follow-ups…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void handleSaveResolutionNotes()}
            disabled={savingNotes}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {savingNotes ? "Saving…" : "Save notes"}
          </button>
          {notesMessage && <span className="text-sm text-stone-600">{notesMessage}</span>}
        </div>
      </div>
    </section>
  );
}
