"use client";

import Link from "next/link";
import {
  publishConfirmMessage,
  resolveMenuBuilderPublishStatus,
  type MenuBuilderPublishStatusKind,
} from "@/lib/open-order-menu-builder-status";
import type { OpenOrderMenuValidationResult } from "@/lib/open-order-menu-validation";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

const STATUS_STYLES: Record<
  MenuBuilderPublishStatusKind,
  { border: string; bg: string; headline: string; detail: string }
> = {
  live: {
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    headline: "text-emerald-950",
    detail: "text-emerald-900",
  },
  unpublished: {
    border: "border-amber-200",
    bg: "bg-amber-50",
    headline: "text-amber-950",
    detail: "text-amber-900",
  },
  never_published: {
    border: "border-sky-200",
    bg: "bg-sky-50",
    headline: "text-sky-950",
    detail: "text-sky-900",
  },
  needs_attention: {
    border: "border-red-200",
    bg: "bg-red-50",
    headline: "text-red-950",
    detail: "text-red-900",
  },
};

type MenuBuilderPublishStatusProps = {
  validation: OpenOrderMenuValidationResult;
  hasPublishedOpenOrderMenu: boolean;
  hasUnpublishedChanges: boolean;
  publishedAtIso: string | null;
  lastUpdatedIso: string | null;
  publishPending: boolean;
  publishError: string | null;
  publishMessage: string | null;
  storefrontHref: string | null;
  onPublish: () => void;
  onPreviewDraft: () => void;
};

export function MenuBuilderPublishStatus({
  validation,
  hasPublishedOpenOrderMenu,
  hasUnpublishedChanges,
  publishedAtIso,
  lastUpdatedIso,
  publishPending,
  publishError,
  publishMessage,
  storefrontHref,
  onPublish,
  onPreviewDraft,
}: MenuBuilderPublishStatusProps) {
  const blockerCount = validation.issues.length;
  const status = resolveMenuBuilderPublishStatus({
    hasPublishedOpenOrderMenu,
    hasUnpublishedChanges,
    validationReady: validation.ready,
    blockerCount,
  });
  const styles = STATUS_STYLES[status.kind];
  const publishDisabled = publishPending || !validation.ready;

  const handlePublishClick = () => {
    const message = publishConfirmMessage({
      hasPublishedOpenOrderMenu,
      hasUnpublishedChanges,
    });
    if (!window.confirm(message)) return;
    onPublish();
  };

  return (
    <section
      className={`rounded-xl border p-5 shadow-sm ${styles.border} ${styles.bg}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Menu status
          </p>
          <h3 className={`mt-1 text-lg font-semibold ${styles.headline}`}>
            {status.headline}
          </h3>
          <p className={`mt-1 text-sm ${styles.detail}`}>{status.detail}</p>
          {status.kind === "live" ? (
            <p className="mt-1 text-xs text-emerald-800">Live / Published</p>
          ) : null}
          {hasUnpublishedChanges && validation.ready ? (
            <p className="mt-1 text-xs text-amber-800">Unpublished changes</p>
          ) : null}
          {!validation.ready ? (
            <p className="mt-1 text-xs text-red-800">
              Needs attention · {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onPreviewDraft}
            className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Preview draft
          </button>
          {storefrontHref ? (
            <Link
              href={storefrontHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              View live menu
            </Link>
          ) : null}
          <button
            type="button"
            disabled={publishDisabled}
            onClick={handlePublishClick}
            title={
              publishDisabled && !validation.ready
                ? `Fix ${blockerCount} issue${blockerCount === 1 ? "" : "s"} before publishing`
                : undefined
            }
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {publishPending
              ? "Publishing…"
              : !validation.ready
                ? `Publish menu (${blockerCount} blocker${blockerCount === 1 ? "" : "s"})`
                : "Publish menu"}
          </button>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-oo-stone-gray">Categories</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {validation.visibleCategoryCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Items</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {validation.visibleItemCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Last edited</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {formatDate(lastUpdatedIso)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Last published</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {formatDate(publishedAtIso)}
          </dd>
        </div>
      </dl>

      {!storefrontHref ? (
        <p className="mt-3 text-sm text-oo-stone-gray">
          Join a pod to get a public live menu link.
        </p>
      ) : null}

      {publishError ? (
        <div className="mt-4 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-red-900">
          {publishError}
        </div>
      ) : null}
      {publishMessage ? (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm text-emerald-900">
          {publishMessage}
        </div>
      ) : null}
    </section>
  );
}
