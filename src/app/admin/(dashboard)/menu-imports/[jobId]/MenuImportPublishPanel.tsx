"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CanonicalMenuDiff } from "@/domain/menu-import/canonical-diff";

export function menuImportPublishUrl(jobId: string, adminSecretForPublish?: string | null): string {
  const path = `/api/admin/menu-imports/${encodeURIComponent(jobId)}/publish`;
  const fromServer = adminSecretForPublish?.trim() ?? "";
  const fromPublicBuild = process.env.NEXT_PUBLIC_ADMIN_SECRET?.trim() ?? "";
  const admin = fromServer || fromPublicBuild;
  if (!admin) return path;
  return `${path}?${new URLSearchParams({ admin }).toString()}`;
}

type SummaryRow = { label: string; value: number };

function buildSummaryRows(summary: CanonicalMenuDiff["summary"], mode: "diff" | "firstPublish" | "draftCounts") {
  const rows: SummaryRow[] =
    mode === "draftCounts"
      ? [
          { label: "Categories (in draft)", value: summary.addedCategories },
          { label: "Products (in draft)", value: summary.addedProducts },
          { label: "Modifier groups (in draft)", value: summary.addedModifierGroups },
          { label: "Modifier options (in draft)", value: summary.addedModifierOptions },
        ]
      : [
          { label: "Categories added", value: summary.addedCategories },
          { label: "Categories removed (live: hidden via items)", value: summary.removedCategories },
          { label: "Categories changed", value: summary.changedCategories },
          { label: "Products added", value: summary.addedProducts },
          { label: "Products removed (live: unavailable)", value: summary.removedProducts },
          { label: "Product price changes", value: summary.changedPrices },
          { label: "Other product field changes", value: summary.changedProductsOther },
          { label: "Modifier groups added", value: summary.addedModifierGroups },
          { label: "Modifier groups removed (live: unavailable)", value: summary.removedModifierGroups },
          { label: "Modifier groups changed", value: summary.changedModifierGroups },
          { label: "Modifier options added", value: summary.addedModifierOptions },
          { label: "Modifier options removed (live: unavailable)", value: summary.removedModifierOptions },
          { label: "Modifier options changed", value: summary.changedModifierOptions },
        ];
  if (mode === "firstPublish") {
    return rows.filter((r) => !r.label.includes("removed") && !r.label.includes("changed"));
  }
  return rows;
}

export function MenuImportPublishPanel({
  jobId,
  canPublish,
  diffSummary,
  summaryMode,
  diffUnavailableNote,
  adminSecretForPublish = null,
  /** When set (e.g. vendor dashboard), POST here instead of admin API (cookie/Bearer auth). */
  publishUrlOverride = null,
}: {
  jobId: string;
  canPublish: boolean;
  diffSummary: CanonicalMenuDiff["summary"] | null;
  /** How to label summary rows in the confirm step. */
  summaryMode: "diff" | "firstPublish" | "draftCounts";
  /** Shown when baseline diff is missing but draft parses (e.g. published snapshot invalid). */
  diffUnavailableNote: string | null;
  adminSecretForPublish?: string | null;
  publishUrlOverride?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const publishUrl =
    publishUrlOverride && publishUrlOverride.trim() !== ""
      ? publishUrlOverride.trim()
      : menuImportPublishUrl(jobId, adminSecretForPublish);
  const publishUrlMissingAdminQuery =
    process.env.NODE_ENV === "production" &&
    !publishUrl.includes("?") &&
    publishUrl.includes("/api/admin/");

  const summaryRows = diffSummary != null ? buildSummaryRows(diffSummary, summaryMode) : [];

  async function handlePublish() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(publishUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        status?: string;
        menuVersionId?: string;
      };
      if (res.ok && (data.status === "published" || data.status === "already_published")) {
        setOpen(false);
        setMessage({
          text:
            data.status === "already_published"
              ? "This draft was already published."
              : "Published successfully. Live menu tables were updated from the canonical snapshot.",
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
    <section
      id="admin-menu-import-publish"
      className="scroll-mt-4 rounded-lg border border-stone-200 bg-white p-4"
    >
      <h2 className="font-medium text-stone-900">Publish to live menu</h2>
      <p className="mt-1 text-sm text-stone-600">
        Writes the draft canonical snapshot to live <code className="rounded bg-stone-100 px-0.5">MenuItem</code> /{" "}
        <code className="rounded bg-stone-100 px-0.5">ModifierGroup</code> /{" "}
        <code className="rounded bg-stone-100 px-0.5">ModifierOption</code> rows.{" "}
        {publishUrlOverride
          ? "Confirm when you are ready. (Auto-publish from Deliverect webhooks is optional in Settings.) "
          : "Confirm manually unless the vendor has auto-publish enabled for webhook imports only. "}
        Removed Deliverect entities are marked unavailable, not deleted.
      </p>
      {publishUrlOverride && (
        <p className="mt-2 text-xs text-stone-600">
          Vendor publish uses your dashboard session (cookie from Settings) or{" "}
          <code className="rounded bg-stone-100 px-0.5">Authorization: Bearer</code> in production.
        </p>
      )}

      {publishUrlMissingAdminQuery && (
        <p className="mt-2 text-xs font-medium text-amber-800">
          Production: ensure <code className="rounded bg-amber-100 px-0.5">ADMIN_SECRET</code> is passed from the
          server or set <code className="rounded bg-amber-100 px-0.5">NEXT_PUBLIC_ADMIN_SECRET</code> at build time,
          or API calls may return 403.
        </p>
      )}

      {message && (
        <p
          className={`mt-3 rounded border px-3 py-2 text-sm ${
            message.error
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
          role="status"
        >
          {message.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canPublish || open}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publish…
        </button>
      </div>

      {open && (
        <div
          className="mt-4 rounded-lg border border-stone-300 bg-stone-50 p-4"
          role="dialog"
          aria-labelledby="publish-confirm-title"
        >
          <h3 id="publish-confirm-title" className="text-sm font-semibold text-stone-900">
            Confirm publish
          </h3>
          {diffUnavailableNote && (
            <p className="mt-2 text-sm text-amber-900">{diffUnavailableNote}</p>
          )}
          {diffSummary ? (
            <div className="mt-3 max-h-56 overflow-auto rounded border border-stone-200 bg-white">
              <table className="w-full text-left text-xs text-stone-800">
                <tbody>
                  {summaryRows
                    .filter((r) => r.value > 0)
                    .map((r) => (
                      <tr key={r.label} className="border-b border-stone-100 last:border-0">
                        <td className="px-3 py-1.5">{r.label}</td>
                        <td className="px-3 py-1.5 font-mono">{r.value}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {summaryRows.every((r) => r.value === 0) && (
                <p className="p-3 text-stone-600">No diff vs baseline — identical Deliverect ids and fields.</p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-sm text-stone-600">No summary available (fix draft parse to see diff counts).</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handlePublish}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Publishing…" : "Yes, publish now"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
