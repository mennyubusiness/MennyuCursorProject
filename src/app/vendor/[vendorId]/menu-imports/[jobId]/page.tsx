import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAdminMenuImportJobDetail,
  fetchLatestPublishedMenuVersionForVendor,
  sortMenuImportIssuesForDisplay,
} from "@/lib/admin-menu-import-queries";
import { diffCanonicalMenus } from "@/domain/menu-import/canonical-diff";
import { mennyuCanonicalMenuSchema, type MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { evaluateMenuImportPublishEligibility } from "@/services/menu-publish-from-canonical.service";
import { evaluateDraftMenuVersionDiscardEligibility } from "@/services/discard-draft-menu-version.service";
import { AdminMenuImportDiffView } from "@/app/admin/(dashboard)/menu-imports/[jobId]/AdminMenuImportDiffView";
import { MenuImportPublishPanel } from "@/app/admin/(dashboard)/menu-imports/[jobId]/MenuImportPublishPanel";
import { MenuImportDiscardDraftButton } from "@/app/admin/(dashboard)/menu-imports/MenuImportDiscardDraftButton";
import { vendorMenuImportDetailPrimaryStatus } from "@/lib/vendor-menu-import-labels";
import { MenuImportIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isVendorDashboardDevOpen, vendorDashboardCookieName } from "@/lib/vendor-dashboard-auth";
import { cookies } from "next/headers";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function parseCanonicalSnapshot(snapshot: unknown): {
  menu: MennyuCanonicalMenu | null;
  parseError: string | null;
} {
  const parsed = mennyuCanonicalMenuSchema.safeParse(snapshot);
  if (parsed.success) return { menu: parsed.data, parseError: null };
  return {
    menu: null,
    parseError: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
  };
}

function severityBadgeClass(sev: string): string {
  switch (sev) {
    case MenuImportIssueSeverity.blocking:
      return "bg-red-100 text-red-900 border-red-200";
    case MenuImportIssueSeverity.warning:
      return "bg-amber-100 text-amber-900 border-amber-200";
    case MenuImportIssueSeverity.info:
      return "bg-sky-100 text-sky-900 border-sky-200";
    default:
      return "bg-stone-100 text-stone-800 border-stone-200";
  }
}

export default async function VendorMenuImportJobPage({
  params,
}: {
  params: Promise<{ vendorId: string; jobId: string }>;
}) {
  const { vendorId, jobId } = await params;
  const job = await fetchAdminMenuImportJobDetail(jobId);
  if (!job) notFound();
  if (job.vendorId !== vendorId) notFound();

  const vendorAuth = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { vendorDashboardToken: true },
  });
  const needsDashboardToken =
    !isVendorDashboardDevOpen() && (!vendorAuth?.vendorDashboardToken || vendorAuth.vendorDashboardToken.trim() === "");

  const cookieStore = await cookies();
  const hasSessionCookie = Boolean(cookieStore.get(vendorDashboardCookieName(vendorId))?.value);
  const needsSessionCookie =
    !isVendorDashboardDevOpen() &&
    Boolean(vendorAuth?.vendorDashboardToken?.trim()) &&
    !hasSessionCookie;

  const publishedRow = await fetchLatestPublishedMenuVersionForVendor(job.vendorId);

  const issues = sortMenuImportIssuesForDisplay(job.issues);
  const blockingCount = issues.filter(
    (i) => i.severity === MenuImportIssueSeverity.blocking && !i.waived
  ).length;
  const warningCount = issues.filter((i) => i.severity === MenuImportIssueSeverity.warning).length;
  const infoCount = issues.filter((i) => i.severity === MenuImportIssueSeverity.info).length;

  const snapshotJson = job.draftVersion?.canonicalSnapshot ?? null;
  const { menu, parseError } = snapshotJson != null ? parseCanonicalSnapshot(snapshotJson) : { menu: null, parseError: null };

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

  const categoryCount = menu?.categories.length ?? 0;
  const productCount = menu?.products.length ?? 0;
  const groupCount = menu?.modifierGroupDefinitions.length ?? 0;
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

  const vendorFriendlyStatus = vendorMenuImportDetailPrimaryStatus({
    status: job.status,
    errorCode: job.errorCode,
    draftVersion: job.draftVersion,
    blockingIssueCount: blockingCount,
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

  const vendorPublishUrl = `/api/vendor/${encodeURIComponent(vendorId)}/menu-imports/${encodeURIComponent(job.id)}/publish`;
  const vendorDiscardUrl = `/api/vendor/${encodeURIComponent(vendorId)}/menu-imports/${encodeURIComponent(job.id)}/discard-draft`;

  const vendorActionsUnlocked = !needsDashboardToken && !needsSessionCookie;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/vendor/${vendorId}/menu-imports`} className="text-sm text-stone-600 hover:underline">
          ← Menu imports
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">Menu update</h1>
        <p className="mt-0.5 font-mono text-sm text-stone-600">{job.id}</p>
      </div>

      {needsDashboardToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <p className="font-medium">Dashboard token required</p>
          <p className="mt-1">
            Ask your Mennyu admin to generate a token, then paste it under{" "}
            <Link href={`/vendor/${vendorId}/settings`} className="font-medium underline">
              Settings
            </Link>{" "}
            to publish from this dashboard in production.
          </p>
        </div>
      )}

      {needsSessionCookie && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <p className="font-medium">Sign in with your dashboard token</p>
          <p className="mt-1">
            Paste your token on{" "}
            <Link href={`/vendor/${vendorId}/settings`} className="font-medium underline">
              Settings
            </Link>{" "}
            to set a browser session before publishing.
          </p>
        </div>
      )}

      {!publishEligibility.canPublish && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          <p className="font-medium">Not ready for publish</p>
          <ul className="mt-2 list-inside list-disc text-amber-900/90">
            {publishEligibility.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Summary</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Status</dt>
            <dd className="text-stone-900">{vendorFriendlyStatus}</dd>
            <dd className="mt-0.5 font-mono text-xs text-stone-500">{job.status}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Source</dt>
            <dd className="font-mono text-stone-900">{job.source}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Started</dt>
            <dd className="text-stone-900">{formatDate(job.startedAt)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Completed</dt>
            <dd className="text-stone-900">{formatDate(job.completedAt)}</dd>
          </div>
        </dl>
      </section>

      <MenuImportPublishPanel
        jobId={job.id}
        canPublish={publishEligibility.canPublish && vendorActionsUnlocked}
        diffSummary={publishSummary}
        summaryMode={publishSummaryMode}
        diffUnavailableNote={publishDiffUnavailableNote}
        adminSecretForPublish={null}
        publishUrlOverride={vendorPublishUrl}
      />

      <MenuImportDiscardDraftButton
        jobId={job.id}
        draftVersionId={job.draftVersionId}
        canDiscard={discardDraftEligibility.canDiscard && vendorActionsUnlocked}
        discardReasons={discardDraftEligibility.reasons}
        discardUrlOverride={vendorDiscardUrl}
        variant="panel"
      />

      <section>
        <h2 className="mb-2 font-medium text-stone-900">Counts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Categories", value: categoryCount },
            { label: "Products", value: productCount },
            { label: "Modifier groups", value: groupCount },
            { label: "Modifier options", value: optionCount },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-lg border border-stone-200 bg-white px-4 py-3 text-center shadow-sm"
            >
              <div className="text-2xl font-semibold text-stone-900">{c.value}</div>
              <div className="text-xs uppercase tracking-wide text-stone-500">{c.label}</div>
            </div>
          ))}
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-center shadow-sm sm:col-span-2 lg:col-span-2">
            <div className="text-2xl font-semibold text-red-900">{blockingCount}</div>
            <div className="text-xs uppercase tracking-wide text-red-700">Blocking issues</div>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-semibold text-amber-900">{warningCount}</div>
            <div className="text-xs uppercase tracking-wide text-amber-800">Warnings</div>
          </div>
          <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-center shadow-sm">
            <div className="text-2xl font-semibold text-sky-900">{infoCount}</div>
            <div className="text-xs uppercase tracking-wide text-sky-800">Info</div>
          </div>
        </div>
      </section>

      <AdminMenuImportDiffView
        hasDraftMenu={!!menu}
        publishedRow={
          publishedRow ? { id: publishedRow.id, publishedAt: publishedRow.publishedAt } : null
        }
        diff={menuDiff}
        baselineError={publishedBaselineError}
      />

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Issues ({issues.length})</h2>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No issues recorded.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {issues.map((i) => (
              <li key={i.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${severityBadgeClass(i.severity)}`}
                  >
                    {i.severity}
                  </span>
                  <span className="font-mono text-xs text-stone-500">{i.kind}</span>
                  <span className="font-mono text-sm font-medium text-stone-900">{i.code}</span>
                </div>
                <p className="mt-1 text-sm text-stone-800">{i.message}</p>
              </li>
            ))}
          </ul>
        )}
        {parseError && (
          <p className="mt-3 text-sm text-red-700">Draft parse error: {parseError}</p>
        )}
      </section>

      {snapshotJson !== null && (
        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-800">
            Canonical snapshot JSON
          </summary>
          <pre className="max-h-96 overflow-auto border-t border-stone-100 p-4 text-xs text-stone-800">
            {JSON.stringify(snapshotJson, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
