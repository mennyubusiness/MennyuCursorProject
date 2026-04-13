import Link from "next/link";
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
import {
  menuImportFriendlySource,
  menuImportListSummaryLine,
  vendorMenuImportListBadge,
  vendorMenuImportListBadgeClass,
} from "@/lib/menu-import-ui-labels";

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
        <h1 className="text-xl font-semibold text-stone-900">Menu sync</h1>
        <p className="mt-1 text-sm text-stone-600">
          Review Deliverect imports and publish when ready — one row per import.
        </p>
      </div>

      {pendingSummary.awaitingReviewCount > 0 && (
        <div
          className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-950"
          role="status"
        >
          <p className="font-medium">
            {pendingSummary.awaitingReviewCount} update
            {pendingSummary.awaitingReviewCount !== 1 ? "s" : ""} need review
            {pendingSummary.vendorsWithPendingCount > 0 && (
              <>
                {" "}
                · {pendingSummary.vendorsWithPendingCount} vendor
                {pendingSummary.vendorsWithPendingCount !== 1 ? "s" : ""}
              </>
            )}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2">Vendor</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Summary</th>
              <th className="px-4 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No menu updates yet.
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
                const isAwaitingReview = j.status === "awaiting_review" && j.draftVersionId != null;
                const dupPayload = isDuplicatePayloadJob(j.id, duplicatePayloadSets);

                const badge = vendorMenuImportListBadge({
                  status: j.status,
                  errorCode: j.errorCode,
                  issues: j.issues,
                  draftVersion: j.draftVersion,
                });
                const summary = menuImportListSummaryLine({
                  status: j.status,
                  errorCode: j.errorCode,
                  issues: j.issues,
                  draftVersion: j.draftVersion,
                  draftVersionId: j.draftVersionId,
                });

                return (
                  <tr
                    key={j.id}
                    className={`hover:bg-stone-50 ${isLatestActionable && isAwaitingReview ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {formatDate(j.completedAt ?? j.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-900">{j.vendor.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={vendorMenuImportListBadgeClass(badge.tone)}>{badge.label}</span>
                      {dupPayload && (
                        <span
                          className="ml-2 text-xs text-amber-800"
                          title="Same payload as another job"
                        >
                          · duplicate
                        </span>
                      )}
                    </td>
                    <td className="max-w-md px-4 py-3 text-stone-600">
                      <span className="line-clamp-2">{summary}</span>
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {menuImportFriendlySource(j.source)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-3">
                        <Link
                          href={`/admin/menu-imports/${j.id}#admin-menu-import-publish`}
                          className={`font-medium hover:underline ${
                            isLatestActionable && isAwaitingReview ? "text-emerald-800" : "text-sky-800"
                          }`}
                        >
                          {isLatestActionable && isAwaitingReview ? "Review & publish" : "Open"}
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
