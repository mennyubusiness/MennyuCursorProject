import Link from "next/link";
import { MenuImportPublishPanel } from "@/components/menu-import/MenuImportPublishPanel";
import {
  liveMenuSourceCopy,
  formatLiveMenuStatusLine,
  formatRelativeSyncTime,
} from "@/lib/vendor-menu-page.helpers";
import { VENDOR_POS_MENU_MANAGED_COPY } from "@/lib/vendor-operational-copy";
import type { VendorMenuPageData } from "@/lib/vendor-menu-page-data.server";
import { VendorMenuHeaderActions } from "./VendorMenuHeaderActions";
import { VendorMenuItemBrowser } from "./VendorMenuItemBrowser";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export function VendorMenuPageView({ data }: { data: VendorMenuPageData }) {
  const { vendorId } = data;
  const hasLiveMenu = data.liveSummary.itemCount > 0;
  const unavailableCount = data.liveSummary.unavailableCount;
  const publishUrl = data.latestImport
    ? `/api/vendor/${encodeURIComponent(vendorId)}/menu-imports/${encodeURIComponent(data.latestImport.jobId)}/publish`
    : null;
  const menuSourceLine = data.posConnected
    ? "Menu synced from your POS."
    : hasLiveMenu
      ? "Managed in Open Order."
      : "Menu sync needs attention.";

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 border-b border-oo-light-stone pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-oo-charcoal">Menu</h2>
          <p className="mt-2 max-w-2xl text-sm text-oo-stone-gray">
            Menu visibility, availability, and sync status.
          </p>
        </div>
        <VendorMenuHeaderActions
          vendorId={vendorId}
          canAdminPull={data.canAdminPull}
          latestImportJobId={data.latestImport?.jobId ?? null}
          canPublish={data.publishGate.canPublish}
        />
      </header>

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-oo-charcoal">Menu status</h3>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-oo-stone-gray">Source</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{menuSourceLine}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Last sync</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">
              {data.publishedAtIso
                ? formatRelativeSyncTime(data.publishedAtIso)
                : data.latestImport?.importedAtIso
                  ? formatRelativeSyncTime(data.latestImport.importedAtIso)
                  : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Active items</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{data.liveSummary.availableCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-oo-stone-gray">Unavailable</dt>
            <dd className="mt-0.5 font-medium text-oo-charcoal">{unavailableCount}</dd>
          </div>
        </dl>
        {!data.menuHealth.ready ? (
          <p className="mt-3 text-sm text-amber-950">Menu sync needs attention — review health below.</p>
        ) : null}
        {data.posConnected ? (
          <p className="mt-3 rounded-lg bg-oo-cream/80 px-3 py-2 text-sm text-oo-stone-gray">
            {VENDOR_POS_MENU_MANAGED_COPY}
          </p>
        ) : null}
        {data.storefrontHref ? (
          <Link
            href={data.storefrontHref}
            className="mt-3 inline-block text-sm font-medium text-oo-charcoal underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View customer menu
          </Link>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Current live menu</h3>
          {hasLiveMenu || data.hasPublishedMenuVersion ? (
            <div className="mt-3 space-y-2 text-sm text-oo-stone-gray">
              <p className="font-medium text-oo-charcoal">
                {data.hasPublishedMenuVersion ? "Published" : "Live items"} · {data.vendorName}
              </p>
              <p>{formatLiveMenuStatusLine(data.liveSummary, data.hasPublishedMenuVersion)}</p>
              <p>Source: {liveMenuSourceCopy(data.menuSource)}</p>
              {data.publishedAtIso ? <p>Last published: {formatDate(data.publishedAtIso)}</p> : null}
            </div>
          ) : (
            <div className="mt-3 text-sm text-oo-stone-gray">
              <p className="font-medium text-oo-charcoal">No published menu</p>
              <p className="mt-1">
                Pull a menu from Deliverect or review the latest import to publish one.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-oo-charcoal">Latest import</h3>
          {data.latestImport ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="text-oo-stone-gray">
                Imported {formatDate(data.latestImport.importedAtIso)} · {data.latestImport.sourceLabel}
              </p>
              <p className="text-oo-charcoal">
                {data.latestImport.categoryCount != null && data.latestImport.itemCount != null
                  ? `${data.latestImport.categoryCount} categories · ${data.latestImport.itemCount} items`
                  : "Draft ready for review"}
                {data.latestImport.blockingIssueCount > 0
                  ? ` · ${data.latestImport.blockingIssueCount} critical issue${data.latestImport.blockingIssueCount === 1 ? "" : "s"}`
                  : ""}
                {data.latestImport.warningIssueCount > 0
                  ? ` · ${data.latestImport.warningIssueCount} warning${data.latestImport.warningIssueCount === 1 ? "" : "s"}`
                  : ""}
              </p>
              <p className="text-oo-stone-gray">
                {data.publishEligibility.displayState === "live"
                  ? data.publishEligibility.infoMessage ?? "Menu is live."
                  : data.publishGate.canPublish
                    ? "Ready to publish after you review changes."
                    : data.publishEligibility.displayState === "processing"
                      ? data.publishEligibility.infoMessage ?? "Menu changes are still being processed."
                      : data.publishEligibility.showPublishWarning
                        ? "Finish required before publishing."
                        : data.publishEligibility.infoMessage ?? "No menu changes are waiting to publish."}
              </p>
              {data.publishGate.canPublish ? null : data.publishEligibility.showPublishWarning &&
                data.publishGate.disabledReasons.length > 0 ? (
                <ul className="list-disc space-y-1 pl-5 text-xs text-amber-950">
                  {data.publishGate.disabledReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap gap-3 pt-1">
                <Link
                  href={`/vendor/${vendorId}/menu-imports/${data.latestImport.jobId}`}
                  className="font-medium text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
                >
                  Review changes
                </Link>
              </div>
              {publishUrl ? (
                <div className="border-t border-oo-light-stone pt-4">
                  <MenuImportPublishPanel
                    jobId={data.latestImport.jobId}
                    canPublish={data.publishGate.canPublish}
                    diffSummary={null}
                    summaryMode="diff"
                    diffUnavailableNote={null}
                    publishUrlOverride={publishUrl}
                    variant="minimal"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 text-sm text-oo-stone-gray">
              <p className="font-medium text-oo-charcoal">No unpublished menu import</p>
              <p className="mt-1">
                Pull latest from Deliverect or publish from Deliverect to send a new menu update.
              </p>
              {data.autoPublishMenus ? (
                <p className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-violet-950">
                  Auto-publish is on for eligible webhook imports.
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-oo-charcoal">Menu health</h3>
            <p className="mt-1 text-sm text-oo-stone-gray">
              {data.menuHealth.ready ? "Ready for ordering" : "Needs attention"}
              {data.menuHealth.criticalCount > 0
                ? ` · ${data.menuHealth.criticalCount} critical`
                : ""}
              {data.menuHealth.warningCount > 0 ? ` · ${data.menuHealth.warningCount} warning${data.menuHealth.warningCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <Link
            href={data.menuHealth.detailHref}
            className="shrink-0 text-sm font-medium text-oo-charcoal underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
          >
            {data.menuHealth.detailLabel}
          </Link>
        </div>
      </section>

      <VendorMenuItemBrowser items={data.displayItems} posConnected={data.posConnected} />
    </div>
  );
}
