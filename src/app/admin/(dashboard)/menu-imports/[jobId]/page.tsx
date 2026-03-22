import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchAdminMenuImportJobDetail,
  fetchLatestPublishedMenuVersionForVendor,
  sortMenuImportIssuesForDisplay,
} from "@/lib/admin-menu-import-queries";
import { diffCanonicalMenus } from "@/domain/menu-import/canonical-diff";
import { mennyuCanonicalMenuSchema, type MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import { env } from "@/lib/env";
import { evaluateMenuImportPublishEligibility } from "@/services/menu-publish-from-canonical.service";
import { AdminMenuImportDiffView } from "./AdminMenuImportDiffView";
import { MenuImportPublishPanel } from "./MenuImportPublishPanel";
import { MenuImportIssueSeverity } from "@prisma/client";

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

export default async function AdminMenuImportJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await fetchAdminMenuImportJobDetail(jobId);
  if (!job) notFound();

  const publishedRow = await fetchLatestPublishedMenuVersionForVendor(job.vendorId);

  const issues = sortMenuImportIssuesForDisplay(job.issues);
  const blockingCount = issues.filter((i) => i.severity === MenuImportIssueSeverity.blocking).length;
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

  const productById = new Map(menu?.products.map((p) => [p.deliverectId, p]) ?? []);
  const groupById = new Map(menu?.modifierGroupDefinitions.map((g) => [g.deliverectId, g]) ?? []);

  const publishEligibility = evaluateMenuImportPublishEligibility({
    status: job.status,
    draftVersionId: job.draftVersionId,
    draftVersion: job.draftVersion,
    issues: job.issues.map((i) => ({ severity: i.severity, waived: i.waived })),
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

  const sortedCategories = menu ? [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  const productIdsInCategories = new Set<string>();
  if (menu) {
    for (const c of menu.categories) {
      for (const pid of c.productDeliverectIds) productIdsInCategories.add(pid);
    }
  }
  const orphanProducts =
    menu?.products.filter((p) => !productIdsInCategories.has(p.deliverectId)) ?? [];

  const rawPayloadJson = job.menuImportRawPayload?.payload ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/menu-imports" className="text-sm text-stone-600 hover:underline">
          ← Menu imports
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">Menu import job</h1>
        <p className="mt-0.5 font-mono text-sm text-stone-600">{job.id}</p>
      </div>

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
          {job.status === "failed" && job.errorCode && (
            <p className="mt-2 font-mono text-xs text-amber-800">errorCode: {job.errorCode}</p>
          )}
        </div>
      )}

      {/* A. Header / summary */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Summary</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-stone-500">Vendor</dt>
            <dd className="text-stone-900">
              <Link
                href={`/admin/vendors/${job.vendor.id}/deliverect-mapping`}
                className="font-medium hover:underline"
              >
                {job.vendor.name}
              </Link>
              <span className="ml-2 text-stone-500">({job.vendor.slug})</span>
            </dd>
          </div>
          <div>
            <dt className="text-stone-500">Source</dt>
            <dd className="font-mono text-stone-900">{job.source}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Status</dt>
            <dd className="font-mono text-stone-900">{job.status}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Draft version</dt>
            <dd className="font-mono text-sm text-stone-900">{job.draftVersionId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Started</dt>
            <dd className="text-stone-900">{formatDate(job.startedAt)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">Completed</dt>
            <dd className="text-stone-900">{formatDate(job.completedAt)}</dd>
          </div>
          {job.deliverectChannelLinkId && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Deliverect</dt>
              <dd className="text-xs text-stone-700">
                channelLink <span className="font-mono">{job.deliverectChannelLinkId}</span>
                {job.deliverectLocationId && (
                  <>
                    {" "}
                    · location <span className="font-mono">{job.deliverectLocationId}</span>
                  </>
                )}
                {job.deliverectMenuId && (
                  <>
                    {" "}
                    · menu <span className="font-mono">{job.deliverectMenuId}</span>
                  </>
                )}
              </dd>
            </div>
          )}
          {job.errorMessage && (
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Job error</dt>
              <dd className="text-red-800">{job.errorMessage}</dd>
            </div>
          )}
        </dl>
      </section>

      <MenuImportPublishPanel
        jobId={job.id}
        canPublish={publishEligibility.canPublish}
        diffSummary={publishSummary}
        summaryMode={publishSummaryMode}
        diffUnavailableNote={publishDiffUnavailableNote}
        adminSecretForPublish={env.ADMIN_SECRET?.trim() ?? null}
      />

      {/* B. Summary cards */}
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
          publishedRow
            ? { id: publishedRow.id, publishedAt: publishedRow.publishedAt }
            : null
        }
        diff={menuDiff}
        baselineError={publishedBaselineError}
      />

      {/* C. Issues */}
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
                <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-stone-500">
                  {i.entityPath && (
                    <span>
                      path: <span className="font-mono text-stone-700">{i.entityPath}</span>
                    </span>
                  )}
                  {i.deliverectId && (
                    <span>
                      deliverectId: <span className="font-mono text-stone-700">{i.deliverectId}</span>
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D. Canonical preview */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="font-medium text-stone-900">Canonical menu preview</h2>
        {!job.draftVersionId && (
          <p className="mt-2 text-sm text-stone-600">No draft version linked to this job.</p>
        )}
        {job.draftVersionId && parseError && (
          <p className="mt-2 text-sm text-red-700">
            Could not parse canonical snapshot: {parseError}
          </p>
        )}
        {menu && (
          <div className="mt-4 space-y-6">
            {sortedCategories.map((cat) => (
              <div key={cat.deliverectId} className="border-l-2 border-stone-300 pl-3">
                <h3 className="font-medium text-stone-900">
                  {cat.name}{" "}
                  <span className="font-mono text-xs font-normal text-stone-500">({cat.deliverectId})</span>
                </h3>
                <ul className="mt-2 space-y-3">
                  {cat.productDeliverectIds.map((pid) => {
                    const p = productById.get(pid);
                    if (!p) {
                      return (
                        <li key={pid} className="text-sm text-amber-800">
                          Missing product ref: <span className="font-mono">{pid}</span>
                        </li>
                      );
                    }
                    return (
                      <li key={pid} className="rounded-md bg-stone-50 p-3 text-sm">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium text-stone-900">{p.name}</span>
                          <span className="font-mono text-stone-700">{formatCents(p.priceCents)}</span>
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-stone-500">{p.deliverectId}</div>
                        {!p.isAvailable && (
                          <span className="mt-1 inline-block text-xs text-red-700">Unavailable</span>
                        )}
                        {p.modifierGroupDeliverectIds.length > 0 && (
                          <div className="mt-2 space-y-2 border-t border-stone-200 pt-2">
                            {p.modifierGroupDeliverectIds.map((gid) => {
                              const g = groupById.get(gid);
                              if (!g) {
                                return (
                                  <div key={gid} className="text-xs text-amber-800">
                                    Unknown group <span className="font-mono">{gid}</span>
                                  </div>
                                );
                              }
                              return (
                                <div key={gid}>
                                  <div className="text-xs font-medium text-stone-700">
                                    {g.name}{" "}
                                    <span className="font-mono font-normal text-stone-500">
                                      ({g.deliverectId}) · min {g.minSelections} / max {g.maxSelections}
                                    </span>
                                  </div>
                                  <ul className="ml-2 mt-1 list-inside list-disc text-xs text-stone-600">
                                    {g.options.map((o) => (
                                      <li key={o.deliverectId}>
                                        {o.name} {formatCents(o.priceCents)}
                                        {!o.isAvailable && " · off"}
                                        {o.isDefault && " · default"}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {sortedCategories.length === 0 && productCount > 0 && (
              <p className="text-sm text-stone-600">
                No categories in canonical menu; {productCount} product(s) in flat list only (check validation
                issues).
              </p>
            )}
            {orphanProducts.length > 0 && (
              <div className="border-t border-stone-200 pt-4">
                <h3 className="text-sm font-medium text-stone-800">
                  Products not listed under any category ({orphanProducts.length})
                </h3>
                <ul className="mt-2 space-y-2 text-sm text-stone-700">
                  {orphanProducts
                    .slice()
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((p) => (
                      <li key={p.deliverectId} className="font-mono text-xs">
                        <span className="font-sans font-medium text-stone-900">{p.name}</span> ·{" "}
                        {formatCents(p.priceCents)} · {p.deliverectId}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* E. Debug JSON */}
      <section className="space-y-3">
        <h2 className="font-medium text-stone-900">Debug</h2>
        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-800">
            Canonical snapshot JSON
          </summary>
          <pre className="max-h-[32rem] overflow-auto border-t border-stone-100 p-4 text-xs leading-relaxed text-stone-800">
            {snapshotJson === null
              ? "—"
              : JSON.stringify(snapshotJson, null, 2)}
          </pre>
        </details>
        <details className="rounded-lg border border-stone-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-stone-800">
            Raw payload JSON
          </summary>
          <pre className="max-h-[32rem] overflow-auto border-t border-stone-100 p-4 text-xs leading-relaxed text-stone-800">
            {rawPayloadJson === null
              ? "— (no MenuImportRawPayload row)"
              : JSON.stringify(rawPayloadJson, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}
