"use client";

import Link from "next/link";
import { useState } from "react";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { PodAdoptionAttentionRow, PodLaunchReadinessSummary } from "@/lib/pod-vendor-adoption";
import { VendorLogo } from "@/components/images/VendorLogo";

function displayStatusBadgeClass(displayStatus: string): string {
  if (displayStatus === "Live") {
    return "rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900";
  }
  if (
    displayStatus.startsWith("Needs ") ||
    displayStatus === "Paused in pod" ||
    displayStatus === "Paused by vendor"
  ) {
    return "rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900";
  }
  return "rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function AttentionRowActions({
  row,
  podSlug,
}: {
  row: PodAdoptionAttentionRow;
  podSlug: string;
}) {
  const [copiedReminder, setCopiedReminder] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  async function handleCopyReminder() {
    setCopyError(null);
    const ok = await copyText(row.reminderText);
    if (ok) {
      setCopiedReminder(true);
      window.setTimeout(() => setCopiedReminder(false), 2000);
      return;
    }
    setCopyError("Could not copy reminder.");
  }

  async function handleCopySetupLink() {
    if (!row.setupPath) return;
    setCopyError(null);
    const absolute =
      typeof window !== "undefined" ? new URL(row.setupPath, window.location.origin).href : row.setupPath;
    const ok = await copyText(absolute);
    if (ok) {
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
      return;
    }
    setCopyError("Could not copy setup link.");
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void handleCopyReminder()}
        className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
      >
        {copiedReminder ? "Copied!" : "Copy reminder"}
      </button>
      {row.setupPath ? (
        <button
          type="button"
          onClick={() => void handleCopySetupLink()}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
        >
          {copiedLink ? "Link copied!" : "Copy setup link"}
        </button>
      ) : null}
      <Link
        href={buildVendorMenuCustomerPath(podSlug, row.vendorSlug)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-oo-charcoal underline hover:text-oo-charcoal"
      >
        View vendor page
      </Link>
      {copyError ? <span className="text-xs text-red-700">{copyError}</span> : null}
    </div>
  );
}

export function PodVendorAdoptionBoard({
  podSlug,
  launchSummary,
  attentionRows,
  pendingCount,
}: {
  podSlug: string;
  launchSummary: PodLaunchReadinessSummary;
  attentionRows: PodAdoptionAttentionRow[];
  pendingCount: number;
}) {
  const bannerClass = launchSummary.allOrderable
    ? "border-emerald-200 bg-emerald-50/80"
    : "border-amber-200 bg-amber-50/60";

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-oo-charcoal">Vendor adoption</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          See who still needs setup before customers can order, and send friendly reminders to vendors.
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${bannerClass}`}>
        <p className="font-medium text-oo-charcoal">{launchSummary.headline}</p>
        <p className="mt-1 text-sm text-oo-stone-gray">{launchSummary.detail}</p>
        {pendingCount > 0 ? (
          <p className="mt-2 text-sm text-oo-stone-gray">
            {pendingCount} invitation{pendingCount === 1 ? "" : "s"} still awaiting vendor response.
          </p>
        ) : null}
      </div>

      {attentionRows.length > 0 ? (
        <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Needs attention</h3>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Vendors who are not orderable yet. Your public roster order below is unchanged.
          </p>
          <ul className="mt-4 space-y-3">
            {attentionRows.map((row) => (
              <li
                key={row.vendorId}
                className="rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3 sm:p-4"
              >
                <div className="flex gap-3">
                  <VendorLogo
                    imageUrl={row.imageUrl}
                    vendorName={row.name}
                    className="h-12 w-12 shrink-0 rounded-lg"
                    sizes="48px"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-oo-charcoal">{row.name}</span>
                      <span className={displayStatusBadgeClass(row.displayStatus)}>{row.displayStatus}</span>
                    </div>
                    <AttentionRowActions row={row} podSlug={podSlug} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : launchSummary.activeVendorCount > 0 ? (
        <p className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-3 text-sm text-oo-stone-gray">
          Every active vendor in your pod is orderable. Drag vendors below to set how they appear on your
          public page.
        </p>
      ) : null}
    </section>
  );
}
