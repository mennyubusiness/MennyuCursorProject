"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { MenuVersionState } from "@prisma/client";

export type MenuHistoryRowClient = {
  id: string;
  state: MenuVersionState;
  publishedAtIso: string | null;
  publishedBy: string | null;
  restoredFromMenuVersionId: string | null;
  createdAtIso: string;
  summary: {
    categories: number;
    products: number;
    modifierGroups: number;
    modifierOptions: number;
  } | null;
  summaryParseError: string | null;
};

export function vendorMenuRollbackUrl(vendorId: string, adminSecret?: string | null): string {
  const path = `/api/admin/vendors/${encodeURIComponent(vendorId)}/menu-versions/rollback`;
  const fromServer = adminSecret?.trim() ?? "";
  const fromPublicBuild = process.env.NEXT_PUBLIC_ADMIN_SECRET?.trim() ?? "";
  const admin = fromServer || fromPublicBuild;
  if (!admin) return path;
  return `${path}?${new URLSearchParams({ admin }).toString()}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function VendorMenuHistoryClient({
  vendorId,
  vendorName,
  currentPublishedId,
  rows,
  adminSecret,
}: {
  vendorId: string;
  vendorName: string;
  currentPublishedId: string | null;
  rows: MenuHistoryRowClient[];
  adminSecret: string | null;
}) {
  const router = useRouter();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const confirmRow = confirmId ? rows.find((r) => r.id === confirmId) : null;
  const rollbackUrl = vendorMenuRollbackUrl(vendorId, adminSecret);

  async function handleRollback() {
    if (!confirmId) return;
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(rollbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ sourceMenuVersionId: confirmId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        newMenuVersionId?: string;
      };
      if (res.ok && data.newMenuVersionId) {
        setConfirmId(null);
        setMessage({
          text: `Rolled back. New published MenuVersion: ${data.newMenuVersionId}. Live tables updated from snapshot.`,
          error: false,
        });
        router.refresh();
      } else {
        const detail = data.code ? `${data.error ?? "Request failed"} (${data.code})` : (data.error ?? res.statusText);
        setMessage({ text: detail || "Request failed", error: true });
      }
    } catch {
      setMessage({ text: "Network or unexpected error", error: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Read-only versioned menus for <span className="font-medium text-stone-900">{vendorName}</span>. Rollback creates
        a <strong>new</strong> published <code className="rounded bg-stone-100 px-0.5">MenuVersion</code> (copy of an
        archived snapshot), archives the current published row, and reapplies the canonical menu to live tables — same
        rules as publish. Prior rows are not edited.
      </p>

      {message && (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            message.error
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2 font-medium">Published</th>
              <th className="px-3 py-2 font-medium">State</th>
              <th className="px-3 py-2 font-medium">By</th>
              <th className="px-3 py-2 font-medium">Counts</th>
              <th className="px-3 py-2 font-medium">Audit</th>
              <th className="px-3 py-2 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-stone-500">
                  No published or archived menu versions yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const isCurrent = r.id === currentPublishedId;
                const canRollback = r.state === "archived" && r.summary != null;
                return (
                  <tr key={r.id} className={isCurrent ? "bg-emerald-50/50" : undefined}>
                    <td className="whitespace-nowrap px-3 py-2 text-stone-800">
                      {formatWhen(r.publishedAtIso)}
                      {isCurrent && (
                        <span className="ml-2 rounded bg-emerald-200 px-1.5 py-0.5 text-xs font-medium text-emerald-900">
                          current
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-stone-700">{r.state}</td>
                    <td className="max-w-[8rem] truncate px-3 py-2 text-xs text-stone-600">
                      {r.publishedBy ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-stone-700">
                      {r.summary ? (
                        <span>
                          {r.summary.products} prod · {r.summary.categories} cat · {r.summary.modifierGroups} grp ·{" "}
                          {r.summary.modifierOptions} opt
                        </span>
                      ) : r.summaryParseError ? (
                        <span className="text-amber-800" title={r.summaryParseError}>
                          parse error
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-[10px] text-stone-500">
                      <div className="max-w-[14rem] truncate" title={r.id}>
                        {r.id}
                      </div>
                      {r.restoredFromMenuVersionId && (
                        <div className="text-stone-400" title={r.restoredFromMenuVersionId}>
                          ← {r.restoredFromMenuVersionId.slice(0, 8)}…
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canRollback ? (
                        <button
                          type="button"
                          disabled={!!confirmId && confirmId !== r.id}
                          onClick={() => {
                            setMessage(null);
                            setConfirmId(r.id);
                          }}
                          className="text-sm font-medium text-red-700 hover:underline disabled:opacity-40"
                        >
                          Roll back to this
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {confirmRow && (
        <div
          className="rounded-lg border border-red-200 bg-red-50/50 p-4"
          role="dialog"
          aria-labelledby="rollback-confirm-title"
        >
          <h2 id="rollback-confirm-title" className="text-sm font-semibold text-red-950">
            Confirm rollback
          </h2>
          <p className="mt-2 text-sm text-stone-800">
            Live menu will match this archived snapshot ({formatWhen(confirmRow.publishedAtIso)}). The current published
            version will be archived and a <strong>new</strong> published row will be created (audit trail preserved).
          </p>
          {confirmRow.summary && (
            <p className="mt-2 text-sm text-stone-700">
              Snapshot counts: {confirmRow.summary.products} products, {confirmRow.summary.categories} categories,{" "}
              {confirmRow.summary.modifierGroups} modifier groups, {confirmRow.summary.modifierOptions} options.
            </p>
          )}
          <p className="mt-1 font-mono text-xs text-stone-600">Source id: {confirmRow.id}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleRollback}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Rolling back…" : "Yes, roll back"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setConfirmId(null)}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
