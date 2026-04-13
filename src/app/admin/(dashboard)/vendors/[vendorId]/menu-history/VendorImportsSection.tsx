import Link from "next/link";
import { MenuImportJobStatus } from "@prisma/client";
import type { AdminMenuImportJobListRow } from "@/lib/admin-menu-import-queries";
import {
  fetchAdminMenuImportJobsForVendor,
  fetchLatestPublishedMenuVersionIdByVendorMap,
  getDuplicatePayloadShaJobIdSets,
  getLatestActionableMenuImportJobForVendor,
  getLatestActionableMenuImportJobIdByVendorMap,
  isDuplicatePayloadJob,
} from "@/lib/admin-menu-import-queries";
import {
  menuImportFriendlySource,
  menuImportListSummaryLine,
  vendorMenuImportListBadge,
  vendorMenuImportListBadgeClass,
} from "@/lib/menu-import-ui-labels";
import { env } from "@/lib/env";
import { evaluateDraftMenuVersionDiscardEligibility } from "@/services/discard-draft-menu-version.service";
import { MenuImportDiscardDraftButton } from "@/app/admin/(dashboard)/menu-imports/MenuImportDiscardDraftButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function isDraftAwaitingReview(j: {
  status: MenuImportJobStatus;
  draftVersionId: string | null;
}): boolean {
  return j.status === MenuImportJobStatus.awaiting_review && j.draftVersionId != null;
}

export async function VendorImportsSection({
  vendorId,
  vendorName,
}: {
  vendorId: string;
  vendorName: string;
}) {
  const adminSecret = env.ADMIN_SECRET?.trim() ?? null;

  const [jobs, pendingJob, publishedByVendor, latestActionableByVendor] = await Promise.all([
    fetchAdminMenuImportJobsForVendor(vendorId, 100),
    getLatestActionableMenuImportJobForVendor(vendorId),
    fetchLatestPublishedMenuVersionIdByVendorMap([vendorId]),
    getLatestActionableMenuImportJobIdByVendorMap([vendorId]),
  ]);

  const duplicatePayloadSets = getDuplicatePayloadShaJobIdSets(jobs);
  const publishedId = publishedByVendor.get(vendorId) ?? null;
  const latestRunId = jobs[0]?.id ?? null;

  const draftJobs = jobs.filter((j) => isDraftAwaitingReview(j));
  const previousJobs = jobs.filter((j) => !isDraftAwaitingReview(j));

  return (
    <div id="vendor-imports" className="space-y-6">
      {pendingJob && (
        <div
          className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-4 text-sm text-amber-950 shadow-sm"
          role="status"
        >
          <p className="font-semibold">Draft available · Unpublished changes</p>
          <p className="mt-1 text-amber-900/90">
            A Deliverect import is waiting for review before it affects the live menu for{" "}
            <strong>{vendorName}</strong>.
          </p>
          <Link
            href={`/admin/menu-imports/${pendingJob.id}#admin-menu-import-publish`}
            className="mt-3 inline-flex rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-950"
          >
            Review &amp; publish
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold text-stone-900">Deliverect imports</h2>
        <p className="mt-1 text-sm text-stone-600">
          Import runs for this vendor. Open a row to view changes, publish, or discard — same as before.
        </p>

        <div className="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
                    No import jobs yet for this vendor.
                  </td>
                </tr>
              ) : (
                <>
                  {draftJobs.length > 0 && (
                    <>
                      <tr className="bg-amber-50/90">
                        <td
                          colSpan={4}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-900"
                        >
                          Draft changes
                        </td>
                      </tr>
                      {draftJobs.map((j) => (
                        <ImportJobRow
                          key={j.id}
                          j={j}
                          publishedId={publishedId}
                          latestActionableJobId={latestActionableByVendor.get(vendorId) ?? null}
                          latestRunId={latestRunId}
                          duplicatePayloadSets={duplicatePayloadSets}
                          adminSecret={adminSecret}
                        />
                      ))}
                    </>
                  )}
                  {previousJobs.length > 0 && (
                    <>
                      <tr className="bg-stone-100/90">
                        <td
                          colSpan={4}
                          className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-600"
                        >
                          Previous imports
                        </td>
                      </tr>
                      {previousJobs.map((j) => (
                        <ImportJobRow
                          key={j.id}
                          j={j}
                          publishedId={publishedId}
                          latestActionableJobId={latestActionableByVendor.get(vendorId) ?? null}
                          latestRunId={latestRunId}
                          duplicatePayloadSets={duplicatePayloadSets}
                          adminSecret={adminSecret}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ImportJobRow({
  j,
  publishedId,
  latestActionableJobId,
  latestRunId,
  duplicatePayloadSets,
  adminSecret,
}: {
  j: AdminMenuImportJobListRow;
  publishedId: string | null;
  latestActionableJobId: string | null;
  latestRunId: string | null;
  duplicatePayloadSets: ReturnType<typeof getDuplicatePayloadShaJobIdSets>;
  adminSecret: string | null;
}) {
  const discardEligibility = evaluateDraftMenuVersionDiscardEligibility({
    draftVersionId: j.draftVersionId,
    draftVersion: j.draftVersion,
    activePublishedMenuVersionId: publishedId,
  });
  const isLatestActionable = latestActionableJobId === j.id;
  const isAwaitingReview = j.status === MenuImportJobStatus.awaiting_review && j.draftVersionId != null;
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
      className={`hover:bg-stone-50/80 ${
        isLatestActionable && isAwaitingReview ? "bg-emerald-50/50" : ""
      }`}
    >
      <td className="whitespace-nowrap px-4 py-3 text-stone-700">
        {formatDate(j.completedAt ?? j.startedAt)}
        {j.id === latestRunId && (
          <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-medium text-stone-700">
            Latest run
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={vendorMenuImportListBadgeClass(badge.tone)}>{badge.label}</span>
        {dupPayload && (
          <span className="ml-2 text-xs text-amber-800" title="Same payload as another job">
            · duplicate
          </span>
        )}
      </td>
      <td className="max-w-md px-4 py-3 text-stone-600">
        <span className="line-clamp-2">{summary}</span>
        <span className="mt-0.5 block text-xs text-stone-500">{menuImportFriendlySource(j.source)}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1 sm:flex-row sm:justify-end sm:gap-3">
          <Link
            href={`/admin/menu-imports/${j.id}#admin-menu-import-publish`}
            className={`font-medium hover:underline ${
              isLatestActionable && isAwaitingReview ? "text-emerald-800" : "text-sky-800"
            }`}
          >
            {isLatestActionable && isAwaitingReview ? "View changes" : "View"}
          </Link>
          <MenuImportDiscardDraftButton
            jobId={j.id}
            draftVersionId={j.draftVersionId}
            canDiscard={discardEligibility.canDiscard}
            discardReasons={discardEligibility.reasons}
            adminSecretForDiscard={adminSecret}
            variant="compact"
          />
        </div>
      </td>
    </tr>
  );
}
