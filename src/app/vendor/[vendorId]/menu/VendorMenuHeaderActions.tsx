"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  vendorId: string;
  canAdminPull: boolean;
  latestImportJobId: string | null;
  canPublish: boolean;
};

export function VendorMenuHeaderActions({
  vendorId,
  canAdminPull,
  latestImportJobId,
  canPublish,
}: Props) {
  const router = useRouter();
  const [pullPending, setPullPending] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);

  async function handlePull() {
    setPullMessage(null);
    setPullPending(true);
    try {
      const res = await fetch(`/api/admin/vendors/${encodeURIComponent(vendorId)}/menu-import/deliverect-pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: "{}",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; jobId?: string };
      if (!res.ok) {
        setPullMessage(data.error ?? "Pull failed.");
        return;
      }
      setPullMessage(data.jobId ? `Menu pull started (job ${data.jobId}).` : "Menu pull completed.");
      router.refresh();
    } catch {
      setPullMessage("Network error while pulling menu.");
    } finally {
      setPullPending(false);
    }
  }

  const secondaryClass =
    "inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal shadow-sm transition hover:bg-oo-cream";
  const primaryClass =
    "inline-flex items-center justify-center rounded-lg bg-oo-charcoal px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {canAdminPull ? (
          <button type="button" className={secondaryClass} disabled={pullPending} onClick={() => void handlePull()}>
            {pullPending ? "Pulling…" : "Pull latest from Deliverect"}
          </button>
        ) : null}
        <Link href={`/vendor/${vendorId}/menu-imports`} className={secondaryClass}>
          View import history
        </Link>
        {latestImportJobId ? (
          <Link href={`/vendor/${vendorId}/menu-imports/${latestImportJobId}`} className={secondaryClass}>
            Review latest import
          </Link>
        ) : null}
        {latestImportJobId && canPublish ? (
          <Link href={`/vendor/${vendorId}/menu-imports/${latestImportJobId}#admin-menu-import-publish`} className={primaryClass}>
            Publish latest menu
          </Link>
        ) : null}
      </div>
      {pullMessage ? <p className="text-xs text-oo-stone-gray sm:text-right">{pullMessage}</p> : null}
    </div>
  );
}
