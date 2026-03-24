"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApiAuthHint } from "@/components/admin/AdminApiAuthHint";

export function menuImportDiscardDraftUrl(jobId: string, adminSecret?: string | null): string {
  const path = `/api/admin/menu-imports/${encodeURIComponent(jobId)}/discard-draft`;
  const fromServer = adminSecret?.trim() ?? "";
  const fromPublicBuild = process.env.NEXT_PUBLIC_ADMIN_SECRET?.trim() ?? "";
  const admin = fromServer || fromPublicBuild;
  if (!admin) return path;
  return `${path}?${new URLSearchParams({ admin }).toString()}`;
}

export function MenuImportDiscardDraftButton({
  jobId,
  draftVersionId,
  canDiscard,
  discardReasons,
  adminSecretForDiscard = null,
  discardUrlOverride = null,
  variant = "compact",
}: {
  jobId: string;
  draftVersionId: string | null;
  canDiscard: boolean;
  discardReasons: string[];
  adminSecretForDiscard?: string | null;
  /** When set (e.g. vendor dashboard), POST goes here with session/Bearer auth instead of admin. */
  discardUrlOverride?: string | null;
  variant?: "compact" | "panel";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const url = discardUrlOverride?.trim()
    ? discardUrlOverride.trim()
    : menuImportDiscardDraftUrl(jobId, adminSecretForDiscard);
  const prodMissingSecret =
    !discardUrlOverride?.trim() &&
    process.env.NODE_ENV === "production" &&
    !url.includes("?");

  const title = !canDiscard ? discardReasons.join(" ") : undefined;

  async function handleDiscard() {
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        discardedMenuVersionId?: string;
      };
      if (res.ok && data.discardedMenuVersionId) {
        setOpen(false);
        setMessage({
          text: "Draft discarded. Import job, issues, and raw payload are kept; job status set to cancelled.",
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

  if (variant === "compact") {
    return (
      <span className="inline-flex flex-col items-end gap-1">
        <button
          type="button"
          title={title}
          disabled={!canDiscard || open}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="text-sm text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
        >
          Discard draft
        </button>
        {message && !open && (
          <span
            className={`max-w-[14rem] text-right text-xs ${message.error ? "text-red-700" : "text-emerald-800"}`}
          >
            {message.text}
          </span>
        )}
        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            role="presentation"
            onClick={() => !loading && setOpen(false)}
          >
            <div
              className="max-w-md rounded-lg border border-stone-200 bg-white p-4 shadow-lg"
              role="dialog"
              aria-labelledby="discard-draft-title"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="discard-draft-title" className="text-sm font-semibold text-stone-900">
                Discard draft MenuVersion?
              </h2>
              <p className="mt-2 text-sm text-stone-700">
                This deletes the draft snapshot row only. The import job stays for audit (issues + raw JSON). The job
                will be marked <span className="font-mono">cancelled</span> and unlinked from this draft.
              </p>
              {draftVersionId && (
                <p className="mt-2 font-mono text-xs text-stone-600">
                  Draft id: {draftVersionId}
                </p>
              )}
              <AdminApiAuthHint show={prodMissingSecret} compact className="mt-2" />
              {message && (
                <p
                  className={`mt-3 rounded border px-2 py-1.5 text-xs ${
                    message.error
                      ? "border-red-200 bg-red-50 text-red-900"
                      : "border-emerald-200 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {message.text}
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDiscard}
                  className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? "Discarding…" : "Yes, discard draft"}
                </button>
              </div>
            </div>
          </div>
        )}
      </span>
    );
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-4">
      <h2 className="font-medium text-stone-900">Discard draft</h2>
      <p className="mt-1 text-sm text-stone-600">
        Remove this draft <code className="rounded bg-stone-100 px-0.5">MenuVersion</code> from review. Does not delete
        the import job, validation issues, or raw Deliverect payload. Does not change live menu tables.
      </p>
      {!canDiscard && discardReasons.length > 0 && (
        <ul className="mt-2 list-inside list-disc text-sm text-stone-600">
          {discardReasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      <AdminApiAuthHint show={prodMissingSecret} className="mt-2" />
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
          disabled={!canDiscard || open}
          onClick={() => {
            setMessage(null);
            setOpen(true);
          }}
          className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Discard draft…
        </button>
      </div>
      {open && (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50/40 p-4"
          role="dialog"
          aria-labelledby="discard-draft-panel-title"
        >
          <h3 id="discard-draft-panel-title" className="text-sm font-semibold text-red-950">
            Confirm discard
          </h3>
          <p className="mt-2 text-sm text-stone-800">
            The draft canonical snapshot will be deleted. Job <span className="font-mono">{jobId}</span> will show{" "}
            <span className="font-mono">cancelled</span> and no linked draft.
          </p>
          {draftVersionId && (
            <p className="mt-2 font-mono text-xs text-stone-600">MenuVersion id: {draftVersionId}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleDiscard}
              className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {loading ? "Discarding…" : "Yes, discard draft"}
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
