import Link from "next/link";
import { VendorSquareCatalogImportControls } from "@/components/vendor/VendorSquareCatalogCard";
import { VendorMenuImportsJobTable } from "@/components/vendor/menu-imports/VendorMenuImportsJobTable";
import { MenuImportMenuPreview } from "@/components/menu-import/MenuImportMenuPreview";
import { MenuImportPublishPanel } from "@/components/menu-import/MenuImportPublishPanel";
import { loadAdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import {
  formatSquareMenuImportsStatusLine,
  loadVendorSquareMenuImportsPanelData,
} from "@/lib/vendor-square-menu-imports-panel-data.server";
import { formatRelativeSyncTime } from "@/lib/vendor-menu-page.helpers";

export async function VendorSquareMenuImportsPanel({ vendorId }: { vendorId: string }) {
  const [squareStatus, panelData] = await Promise.all([
    loadAdminSquareRoutingStatus(vendorId),
    loadVendorSquareMenuImportsPanelData(vendorId),
  ]);

  const canImport = squareStatus.isSelectable;
  const disabledReason = canImport
    ? null
    : squareStatus.missingRequirements[0] ??
      "Complete Square connection setup before importing your catalog.";

  const draft = panelData.latestDraft;
  const vendorPublishUrl = draft
    ? `/api/vendor/${encodeURIComponent(vendorId)}/menu-imports/${encodeURIComponent(draft.jobId)}/publish`
    : null;

  return (
    <section className="space-y-6 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-base font-semibold text-oo-charcoal">Square</h3>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Import your Square catalog into a draft menu, preview it grouped by category, then publish
            when you are ready. Imports do not go live until you publish.
          </p>
        </div>
        {draft ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/vendor/${vendorId}/menu-imports/${draft.jobId}`}
              className="inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
            >
              Full review
            </Link>
            {draft.publishGate.canPublish ? (
              <Link
                href={`/vendor/${vendorId}/menu-imports/${draft.jobId}#admin-menu-import-publish`}
                className="inline-flex items-center justify-center rounded-lg bg-oo-charcoal px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
              >
                Publish imported menu
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs text-oo-stone-gray">Connection</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {squareStatus.hasConnection ? squareStatus.statusMessage : "Not connected"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Live menu items</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {panelData.liveSummary.availableCount} available
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Last Square import</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {panelData.lastSquareImportAtIso
              ? formatRelativeSyncTime(panelData.lastSquareImportAtIso)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-oo-stone-gray">Last published</dt>
          <dd className="mt-0.5 font-medium text-oo-charcoal">
            {panelData.publishedAtIso ? formatRelativeSyncTime(panelData.publishedAtIso) : "—"}
          </dd>
        </div>
      </dl>

      <p className="rounded-md border border-oo-light-stone bg-oo-cream/60 px-3 py-2 text-xs text-oo-stone-gray">
        {formatSquareMenuImportsStatusLine(panelData)}
      </p>

      {!squareStatus.hasConnection ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Connect Square before importing a menu.{" "}
          <Link href={squareStatus.integrationUrl} className="font-medium underline">
            Open Square integration
          </Link>
        </p>
      ) : null}

      {squareStatus.hasConnection && !squareStatus.isSelectable ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Square is connected but not ready for catalog import.{" "}
          <Link href={squareStatus.integrationUrl} className="font-medium underline">
            Fix Square connection
          </Link>
        </p>
      ) : null}

      {squareStatus.hasConnection ? (
        <VendorSquareCatalogImportControls
          vendorId={vendorId}
          health={squareStatus.health}
          canImport={canImport}
          disabledReason={disabledReason}
        />
      ) : null}

      {draft ? (
        <section className="space-y-4 rounded-lg border border-violet-200 bg-violet-50/40 p-4">
          <div>
            <h4 className="text-sm font-semibold text-oo-charcoal">Draft menu preview</h4>
            <p className="mt-1 text-xs text-oo-stone-gray">
              This is how your imported Square menu will look after publish. It is not visible to
              customers yet.
            </p>
          </div>
          <MenuImportMenuPreview
            menu={draft.menu}
            parseError={draft.parseError}
            draftVersionId={draft.draftVersionId}
            hideDeliverectIds
          />
          {draft.issueCounts.warning > 0 ? (
            <p className="text-xs text-amber-900">
              {draft.issueCounts.warning} import warning
              {draft.issueCounts.warning === 1 ? "" : "s"} — see{" "}
              <Link
                href={`/vendor/${vendorId}/menu-imports/${draft.jobId}`}
                className="font-medium underline"
              >
                full review
              </Link>{" "}
              for details.
            </p>
          ) : null}
          {vendorPublishUrl ? (
            <MenuImportPublishPanel
              jobId={draft.jobId}
              canPublish={draft.publishGate.canPublish}
              diffSummary={null}
              summaryMode="draftCounts"
              diffUnavailableNote={null}
              publishUrlOverride={vendorPublishUrl}
              variant="minimal"
              publishButtonLabel="Publish imported menu"
              confirmTitle="Publish imported Square menu"
              confirmDescription="Publishing will replace this vendor's currently published menu with the imported Square menu. Open Order checkout and payouts are unchanged."
            />
          ) : null}
        </section>
      ) : null}

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-oo-charcoal">Import history</h4>
          {panelData.publishedAtIso ? (
            <Link href={`/vendor/${vendorId}/menu`} className="text-sm font-medium text-sky-800 hover:underline">
              View live menu
            </Link>
          ) : null}
        </div>
        <VendorMenuImportsJobTable vendorId={vendorId} />
      </div>
    </section>
  );
}
