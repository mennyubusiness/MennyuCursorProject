import Link from "next/link";
import { MenuImportIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  menuImportFriendlySource,
  menuImportListSummaryLine,
  vendorMenuImportListBadge,
  vendorMenuImportListBadgeClass,
} from "@/lib/menu-import-ui-labels";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

export async function VendorMenuImportsJobTable({ vendorId }: { vendorId: string }) {
  const jobs = await prisma.menuImportJob.findMany({
    where: { vendorId },
    orderBy: { startedAt: "desc" },
    take: 40,
    select: {
      id: true,
      source: true,
      status: true,
      errorCode: true,
      startedAt: true,
      completedAt: true,
      draftVersionId: true,
      draftVersion: {
        select: { publishedBy: true },
      },
      issues: {
        where: { severity: MenuImportIssueSeverity.blocking, waived: false },
        select: { id: true },
      },
    },
  });

  const latestActionableId = jobs.find(
    (j) => j.status === "awaiting_review" && j.draftVersionId != null
  )?.id;

  return (
    <div className="overflow-hidden rounded-lg border border-oo-light-stone bg-oo-warm-white">
      <table className="min-w-full text-sm">
        <thead className="border-b border-oo-light-stone bg-oo-cream text-left text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
          <tr>
            <th className="px-4 py-2">Updated</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Summary</th>
            <th className="px-4 py-2 text-right"> </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-oo-light-stone">
          {jobs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-oo-stone-gray">
                No imports yet.
              </td>
            </tr>
          ) : (
            jobs.map((j) => {
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
              const isActionableHighlight = j.id === latestActionableId;

              return (
                <tr
                  key={j.id}
                  className={`hover:bg-oo-cream ${isActionableHighlight ? "bg-emerald-50/60" : ""}`}
                >
                  <td className="whitespace-nowrap px-4 py-3 text-oo-charcoal">
                    {formatDate(j.completedAt ?? j.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={vendorMenuImportListBadgeClass(badge.tone)}>{badge.label}</span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-oo-stone-gray">
                    <span className="line-clamp-2">{summary}</span>
                    <span className="mt-0.5 block text-xs text-oo-stone-gray">
                      {menuImportFriendlySource(j.source)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <Link
                      href={`/vendor/${vendorId}/menu-imports/${j.id}`}
                      className={`font-medium hover:underline ${
                        isActionableHighlight ? "text-emerald-800" : "text-sky-800"
                      }`}
                    >
                      {isActionableHighlight ? "Review & publish" : "Open"}
                    </Link>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
