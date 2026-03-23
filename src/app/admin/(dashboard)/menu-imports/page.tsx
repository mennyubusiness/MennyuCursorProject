import Link from "next/link";
import { MenuImportSource } from "@prisma/client";
import {
  fetchAdminMenuImportJobsList,
  fetchLatestPublishedMenuVersionIdByVendorMap,
  fetchPendingMenuImportJobsSummary,
  getDuplicatePayloadShaJobIdSets,
  getLatestActionableMenuImportJobIdByVendorMap,
  isDuplicatePayloadJob,
} from "@/lib/admin-menu-import-queries";
import { env } from "@/lib/env";
import { evaluateDraftMenuVersionDiscardEligibility } from "@/services/discard-draft-menu-version.service";
import { MenuImportDiscardDraftButton } from "./MenuImportDiscardDraftButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export default async function AdminMenuImportsListPage() {
  const jobs = await fetchAdminMenuImportJobsList(100);
  const publishedByVendor = await fetchLatestPublishedMenuVersionIdByVendorMap(
    jobs.map((j) => j.vendor.id)
  );
  const pendingSummary = await fetchPendingMenuImportJobsSummary();
  const latestActionableByVendor = await getLatestActionableMenuImportJobIdByVendorMap(
    jobs.map((j) => j.vendorId)
  );
  const duplicatePayloadSets = getDuplicatePayloadShaJobIdSets(jobs);

  const sorted = [...jobs].sort((a, b) => {
    const n = a.vendor.name.localeCompare(b.vendor.name);
    if (n !== 0) return n;
    return b.startedAt.getTime() - a.startedAt.getTime();
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Menu imports</h1>
        <p className="mt-1 text-sm text-stone-600">
          Review Deliverect menu import jobs and draft canonical menus. Publish applies the draft snapshot to live
          menu rows — no auto-publish.
        </p>
      </div>

      {pendingSummary.awaitingReviewCount > 0 && (
        <div
          className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
          role="status"
        >
          <p className="font-medium">New menu update(s) from Deliverect</p>
          <p className="mt-1 text-sky-900/90">
            <strong>{pendingSummary.awaitingReviewCount}</strong> job
            {pendingSummary.awaitingReviewCount !== 1 ? "s" : ""} awaiting review
            {pendingSummary.vendorsWithPendingCount > 0 && (
              <>
                {" "}
                across <strong>{pendingSummary.vendorsWithPendingCount}</strong> vendor
                {pendingSummary.vendorsWithPendingCount !== 1 ? "s" : ""}
              </>
            )}
            . Open the latest job per vendor and publish when ready.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">Started</th>
              <th className="px-4 py-2 font-medium">Vendor</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Draft</th>
              <th className="px-4 py-2 font-medium">Issues</th>
              <th className="px-4 py-2 font-medium">Flags</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-stone-500">
                  No menu import jobs yet.
                </td>
              </tr>
            ) : (
              sorted.map((j) => {
                const discardEligibility = evaluateDraftMenuVersionDiscardEligibility({
                  draftVersionId: j.draftVersionId,
                  draftVersion: j.draftVersion,
                  activePublishedMenuVersionId: publishedByVendor.get(j.vendor.id) ?? null,
                });
                const isLatestActionable = latestActionableByVendor.get(j.vendorId) === j.id;
                const blockingCount = j.issues.length;
                const isAwaitingReview = j.status === "awaiting_review" && j.draftVersionId != null;
                const isWebhook = j.source === MenuImportSource.DELIVERECT_MENU_WEBHOOK;
                const dupPayload = isDuplicatePayloadJob(j.id, duplicatePayloadSets);

                return (
                  <tr
                    key={j.id}
                    className={`hover:bg-stone-50 ${isLatestActionable && isAwaitingReview ? "bg-emerald-50/50" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-2 text-stone-700">{formatDate(j.startedAt)}</td>
                    <td className="px-4 py-2 text-stone-900">
                      <span className="font-medium">{j.vendor.name}</span>
                      <span className="ml-1 text-xs text-stone-500">({j.vendor.slug})</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-stone-600">{j.source}</td>
                    <td className="px-4 py-2 font-mono text-xs text-stone-800">{j.status}</td>
                    <td className="px-4 py-2 font-mono text-xs text-stone-600">
                      {j.draftVersionId ? j.draftVersionId.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-2 text-stone-700">
                      {j._count.issues}
                      {blockingCount > 0 && (
                        <span className="ml-1 text-red-700">
                          ({blockingCount} blocking)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1">
                        {isLatestActionable && isAwaitingReview && (
                          <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-xs font-medium text-emerald-950">
                            Latest · review
                          </span>
                        )}
                        {isAwaitingReview && isWebhook && (
                          <span className="rounded bg-sky-200 px-1.5 py-0.5 text-xs font-medium text-sky-950">
                            Webhook
                          </span>
                        )}
                        {dupPayload && (
                          <span
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950"
                            title="Same raw payload SHA as another job (likely duplicate webhook delivery)"
                          >
                            Duplicate payload
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-3">
                        <Link
                          href={`/admin/menu-imports/${j.id}#admin-menu-import-publish`}
                          className="font-medium text-sky-800 hover:underline"
                        >
                          {isLatestActionable && isAwaitingReview ? "Review & publish" : "Review"}
                        </Link>
                        <MenuImportDiscardDraftButton
                          jobId={j.id}
                          draftVersionId={j.draftVersionId}
                          canDiscard={discardEligibility.canDiscard}
                          discardReasons={discardEligibility.reasons}
                          adminSecretForDiscard={env.ADMIN_SECRET?.trim() ?? null}
                          variant="compact"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
