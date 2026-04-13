import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAdminMenuImportJobDetail,
  fetchLatestPublishedMenuVersionForVendor,
  getLatestActionableMenuImportJobForVendor,
  sortMenuImportIssuesForDisplay,
} from "@/lib/admin-menu-import-queries";
import { diffCanonicalMenus } from "@/domain/menu-import/canonical-diff";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { parseCanonicalSnapshot } from "@/lib/menu-import-canonical-preview";
import { env } from "@/lib/env";
import { evaluateDraftMenuVersionDiscardEligibility } from "@/services/discard-draft-menu-version.service";
import { evaluateMenuImportPublishEligibility } from "@/services/menu-publish-from-canonical.service";
import { AdminMenuImportDiffView } from "./AdminMenuImportDiffView";
import { MenuImportDiscardDraftButton } from "../MenuImportDiscardDraftButton";
import { MenuImportPublishPanel } from "@/components/menu-import/MenuImportPublishPanel";
import { MenuImportWhatChanged } from "@/components/menu-import/MenuImportWhatChanged";
import { MenuImportIssuesList } from "@/components/menu-import/MenuImportIssuesList";
import { MenuImportMenuPreview } from "@/components/menu-import/MenuImportMenuPreview";
import { MenuImportAdvancedDetails } from "@/components/menu-import/MenuImportAdvancedDetails";
import { MenuImportJobNextStepsAdmin } from "@/components/menu-import/MenuImportJobNextSteps";
import { menuImportFriendlySource } from "@/lib/menu-import-ui-labels";
import { vendorMenuImportDetailPrimaryStatus } from "@/lib/vendor-menu-import-labels";
import { MenuImportIssueSeverity } from "@prisma/client";
import { runMenuParityAudit } from "@/services/menu-parity.service";
import { MenuParityAuditBanner } from "@/components/menu-import/MenuParityAuditBanner";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function AdminMenuImportJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await fetchAdminMenuImportJobDetail(jobId);
  if (!job) notFound();

  const publishedRow = await fetchLatestPublishedMenuVersionForVendor(job.vendorId);
  const latestActionableForVendor = await getLatestActionableMenuImportJobForVendor(job.vendorId);
  const isLatestActionableJob =
    latestActionableForVendor != null &&
    latestActionableForVendor.id === job.id &&
    job.status === "awaiting_review" &&
    job.draftVersionId != null;

  const issues = sortMenuImportIssuesForDisplay(job.issues);
  const blockingForStatus = issues.filter(
    (i) => i.severity === MenuImportIssueSeverity.blocking && !i.waived
  ).length;

  const snapshotJson = job.draftVersion?.canonicalSnapshot ?? null;
  const { menu, parseError } =
    snapshotJson != null ? parseCanonicalSnapshot(snapshotJson) : { menu: null, parseError: null };

  let publishedBaselineError: string | null = null;
  let menuDiff = null;
  if (menu) {
    if (publishedRow) {
      const pr = mennyuCanonicalMenuSchema.safeParse(publishedRow.canonicalSnapshot);
      if (pr.success) {
        menuDiff = diffCanonicalMenus(menu, pr.data, publishedRow.id);
      } else {
        publishedBaselineError =
          "Could not parse published MenuVersion canonicalSnapshot — diff skipped. Fix or republish baseline.";
      }
    } else {
      menuDiff = diffCanonicalMenus(menu, null, null);
    }
  }

  const optionCount =
    menu?.modifierGroupDefinitions.reduce((n, g) => n + g.options.length, 0) ?? 0;

  const publishEligibility = evaluateMenuImportPublishEligibility({
    status: job.status,
    draftVersionId: job.draftVersionId,
    draftVersion: job.draftVersion,
    issues: job.issues.map((i) => ({ severity: i.severity, waived: i.waived })),
  });

  const discardDraftEligibility = evaluateDraftMenuVersionDiscardEligibility({
    draftVersionId: job.draftVersionId,
    draftVersion: job.draftVersion,
    activePublishedMenuVersionId: publishedRow?.id ?? null,
  });

  const draftCountsSummary =
    menu && publishedBaselineError
      ? {
          addedCategories: menu.categories.length,
          removedCategories: 0,
          changedCategories: 0,
          addedProducts: menu.products.length,
          removedProducts: 0,
          changedPrices: 0,
          changedProductsOther: 0,
          addedModifierGroups: menu.modifierGroupDefinitions.length,
          removedModifierGroups: 0,
          changedModifierGroups: 0,
          addedModifierOptions: optionCount,
          removedModifierOptions: 0,
          changedModifierOptions: 0,
        }
      : null;

  const publishSummary = menuDiff?.summary ?? draftCountsSummary;
  const publishSummaryMode: "diff" | "firstPublish" | "draftCounts" = menuDiff
    ? menuDiff.isFirstPublish
      ? "firstPublish"
      : "diff"
    : draftCountsSummary
      ? "draftCounts"
      : "diff";

  const publishDiffUnavailableNote =
    menu && publishedBaselineError && publishedRow
      ? `${publishedBaselineError} Showing draft entity counts only (not a full diff).`
      : null;

  const rawPayloadJson = job.menuImportRawPayload?.payload ?? null;

  const headlineStatus = vendorMenuImportDetailPrimaryStatus({
    status: job.status,
    errorCode: job.errorCode,
    draftVersion: job.draftVersion,
    blockingIssueCount: blockingForStatus,
  });

  const newerActionable =
    latestActionableForVendor &&
    latestActionableForVendor.id !== job.id &&
    job.status === "awaiting_review"
      ? { id: latestActionableForVendor.id, startedAt: latestActionableForVendor.startedAt }
      : null;

  const menuParity = await runMenuParityAudit(job.vendorId);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href={`/admin/vendors/${job.vendorId}/menu-history#vendor-imports`}
            className="text-sm text-stone-600 hover:underline"
          >
            ← Menu management
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-stone-900">{job.vendor.name}</h1>
          <p className="mt-1 text-sm text-stone-700">{headlineStatus}</p>
          <p className="mt-0.5 text-sm text-stone-500">
            Updated {formatDate(job.completedAt ?? job.startedAt)} · {menuImportFriendlySource(job.source)}
          </p>
        </div>
      </div>

      <MenuImportJobNextStepsAdmin
        vendorName={job.vendor.name}
        isLatestActionableJob={isLatestActionableJob}
        newerActionableJob={newerActionable}
        publishBlocked={!publishEligibility.canPublish}
        publishReasons={publishEligibility.reasons}
        failedErrorCode={job.status === "failed" ? job.errorCode : null}
      />

      <MenuParityAuditBanner audit={menuParity} />

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">What changed</h2>
        <p className="mt-1 text-sm text-stone-600">Compared to your live Mennyu menu (same Deliverect-linked items).</p>
        <div className="mt-3">
          <MenuImportWhatChanged summary={publishSummary} summaryMode={publishSummaryMode} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Issues</h2>
        <p className="mt-1 text-sm text-stone-600">Anything that blocks publishing or needs your attention.</p>
        <div className="mt-3">
          <MenuImportIssuesList issues={issues} showTechnicalMeta={false} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Menu preview</h2>
        <p className="mt-1 text-sm text-stone-600">How this draft looks in Mennyu (names, prices, modifiers).</p>
        <div className="mt-4">
          <MenuImportMenuPreview
            menu={menu}
            parseError={parseError}
            draftVersionId={job.draftVersionId}
            hideDeliverectIds
          />
        </div>
      </section>

      <div className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
        <p className="text-sm font-medium text-stone-900">Actions</p>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            <MenuImportPublishPanel
              jobId={job.id}
              canPublish={publishEligibility.canPublish}
              diffSummary={publishSummary}
              summaryMode={publishSummaryMode}
              diffUnavailableNote={publishDiffUnavailableNote}
              adminSecretForPublish={env.ADMIN_SECRET?.trim() ?? null}
            />
          </div>
          <div className="min-w-0 flex-1">
            <MenuImportDiscardDraftButton
              jobId={job.id}
              draftVersionId={job.draftVersionId}
              canDiscard={discardDraftEligibility.canDiscard}
              discardReasons={discardDraftEligibility.reasons}
              adminSecretForDiscard={env.ADMIN_SECRET?.trim() ?? null}
              variant="panel"
            />
          </div>
        </div>
        <p className="text-sm text-stone-600">
          <Link
            href={`/admin/vendors/${job.vendorId}/menu-history#vendor-imports`}
            className="font-medium text-sky-800 hover:underline"
          >
            Back to vendor imports
          </Link>
        </p>
      </div>

      <details className="rounded-lg border border-stone-200 bg-white">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-800">
          Detailed technical diff
        </summary>
        <div className="border-t border-stone-100 p-4">
          <AdminMenuImportDiffView
            hasDraftMenu={!!menu}
            publishedRow={
              publishedRow
                ? { id: publishedRow.id, publishedAt: publishedRow.publishedAt }
                : null
            }
            diff={menuDiff}
            baselineError={publishedBaselineError}
          />
        </div>
      </details>

      <MenuImportAdvancedDetails
        jobId={job.id}
        status={job.status}
        source={job.source}
        errorCode={job.errorCode}
        errorMessage={job.errorMessage}
        startedAt={job.startedAt}
        completedAt={job.completedAt}
        draftVersionId={job.draftVersionId}
        deliverectChannelLinkId={job.deliverectChannelLinkId}
        deliverectLocationId={job.deliverectLocationId}
        deliverectMenuId={job.deliverectMenuId}
        snapshotJson={snapshotJson}
        rawPayloadJson={rawPayloadJson}
      />
    </div>
  );
}
