"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";
import { vendorSetupChecklistSummary } from "@/lib/vendor-setup-checklist-summary";

function ownerLabel(owner: ReadinessChecklistItem["owner"]): string {
  if (owner === "pod_owner") return "Pod owner";
  if (owner === "open_order") return "Open Order";
  return "Vendor";
}

export function vendorSetupItemStatusLabel(item: ReadinessChecklistItem): string {
  if (item.complete) return "Ready";
  if (item.key === "pod_invite" && item.description?.includes("pending invitation")) {
    return "Waiting for vendor acceptance";
  }
  if (item.key === "pod_invite" && !item.complete) {
    return "Waiting for pod approval";
  }
  return "Needs attention";
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden
      className={`h-4 w-4 shrink-0 text-oo-stone-gray transition-transform ${expanded ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.25a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function VendorSetupChecklist({
  items,
  title = "Getting started",
  emptyCompleteCopy,
}: {
  items: ReadinessChecklistItem[];
  title?: string;
  emptyCompleteCopy?: string;
}) {
  const summary = vendorSetupChecklistSummary(items);
  const [expanded, setExpanded] = useState(summary.defaultExpanded);

  if (items.length === 0 && emptyCompleteCopy) {
    return (
      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 px-4 py-6 text-sm text-oo-stone-gray">
        <p>{emptyCompleteCopy}</p>
      </section>
    );
  }

  if (items.length === 0) {
    return null;
  }

  const sectionBadgeClass = summary.allReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/80 text-sm text-oo-charcoal">
      <button
        type="button"
        className="flex w-full items-start gap-3 p-4 text-left"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-oo-charcoal">{title}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${sectionBadgeClass}`}>
              {summary.allReady ? "Ready" : "Needs attention"}
            </span>
            <span className="text-xs text-oo-stone-gray">
              {summary.readyCount} of {summary.total} ready
            </span>
          </div>
          {!expanded && !summary.allReady && summary.incompleteLabels.length > 0 ? (
            <p className="mt-2 text-xs text-amber-900">
              Still needed: {summary.incompleteLabels.join(", ")}
            </p>
          ) : null}
          {!expanded && summary.allReady ? (
            <p className="mt-2 text-xs text-emerald-800">All requirements complete.</p>
          ) : null}
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded ? (
        <ol className="space-y-3 border-t border-oo-light-stone px-4 pb-4 pt-3">
          {items.map((item, index) => {
            const statusLabel = vendorSetupItemStatusLabel(item);
            return (
              <li key={item.key} className="flex gap-3">
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    item.complete ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"
                  }`}
                  aria-hidden
                >
                  {item.complete ? "✓" : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-medium text-oo-charcoal">{item.label}</span>
                    <span
                      className={`text-xs ${
                        item.complete ? "text-emerald-800" : "text-amber-900"
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  {item.description ? (
                    <p className="mt-0.5 text-oo-stone-gray">{item.description}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded bg-oo-warm-white px-1.5 py-0.5 text-oo-stone-gray">
                      {ownerLabel(item.owner)}
                    </span>
                    {item.actionHref && item.actionLabel ? (
                      <Link
                        href={item.actionHref}
                        className="font-medium text-oo-charcoal hover:underline"
                      >
                        {item.actionLabel}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
