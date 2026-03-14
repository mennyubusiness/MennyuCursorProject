"use client";

import { useState } from "react";
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

export function AdminOrderIssuesSection({
  orderIssues,
  vendorOrderIssues,
}: {
  orderIssues: OrderIssueRow[];
  vendorOrderIssues: VendorOrderIssueRow[];
}) {
  const router = useRouter();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [updatingNotesId, setUpdatingNotesId] = useState<string | null>(null);

  const allOrderIssues = orderIssues.map((i) => ({ ...i, kind: "order" as const }));
  const allVoIssues = vendorOrderIssues.map((i) => ({ ...i, kind: "vendor" as const }));
  const all = [...allOrderIssues, ...allVoIssues].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

  async function handleUpdateNotes(kind: "order" | "vendor", issueId: string) {
    const value = notesDraft[issueId] ?? "";
    setUpdatingNotesId(issueId);
    try {
      const base = kind === "order" ? "/api/admin/order-issues" : "/api/admin/vendor-order-issues";
      const res = await fetch(`${base}/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value || null }),
      });
      if (res.ok) {
        setNotesDraft((prev) => {
          const next = { ...prev };
          delete next[issueId];
          return next;
        });
        router.refresh();
      }
    } finally {
      setUpdatingNotesId(null);
    }
  }

  if (all.length === 0) {
    return (
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Issues</h2>
        <p className="mt-2 text-sm text-stone-500">No issues recorded for this order.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-medium text-stone-900">Issues</h2>
      <ul className="mt-2 space-y-3">
        {all.map((issue) => (
          <li
            key={issue.id}
            className="rounded border border-stone-200 bg-stone-50/50 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-stone-800">
                {issue.type.replace(/_/g, " ")}
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
                  issue.status === "RESOLVED"
                    ? "text-stone-500"
                    : "font-medium text-stone-900"
                }
              >
                {issue.status}
              </span>
              {"vendorName" in issue && (
                <span className="text-stone-500">({issue.vendorName})</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-stone-500">
              {formatDate(new Date(issue.createdAt))}
              {issue.resolvedAt && ` · Resolved ${formatDate(new Date(issue.resolvedAt))}`}
            </p>
            {issue.notes && (
              <p className="mt-1 text-stone-600">{issue.notes}</p>
            )}
            {issue.status === "OPEN" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResolve(issue.kind, issue.id)}
                  disabled={resolvingId === issue.id}
                  className="rounded bg-stone-700 px-2 py-1 text-xs text-white hover:bg-stone-800 disabled:opacity-50"
                >
                  {resolvingId === issue.id ? "…" : "Mark resolved"}
                </button>
                <input
                  type="text"
                  placeholder="Add or update note"
                  className="rounded border border-stone-300 px-2 py-1 text-xs"
                  value={notesDraft[issue.id] ?? ""}
                  onChange={(e) =>
                    setNotesDraft((prev) => ({ ...prev, [issue.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUpdateNotes(issue.kind, issue.id);
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleUpdateNotes(issue.kind, issue.id)}
                  disabled={updatingNotesId === issue.id}
                  className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50"
                >
                  {updatingNotesId === issue.id ? "…" : "Update notes"}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
