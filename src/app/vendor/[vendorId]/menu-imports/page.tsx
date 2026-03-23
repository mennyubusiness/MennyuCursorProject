import Link from "next/link";
import { notFound } from "next/navigation";
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

export default async function VendorMenuImportsListPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, autoPublishMenus: true },
  });
  if (!vendor) notFound();

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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Menu updates</h2>
        <p className="mt-1 text-sm text-stone-600">
          When Deliverect sends a menu change, it appears here. Publish when you&apos;re ready for it to go live on
          Mennyu.
        </p>
        {vendor.autoPublishMenus && (
          <p className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
            <strong>Auto-publish</strong> is on for eligible webhook imports (no blocking issues).
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs font-medium uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2">Updated</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Summary</th>
              <th className="px-4 py-2 text-right"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                  No updates yet.
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
                    className={`hover:bg-stone-50 ${isActionableHighlight ? "bg-emerald-50/60" : ""}`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-stone-700">
                      {formatDate(j.completedAt ?? j.startedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={vendorMenuImportListBadgeClass(badge.tone)}>{badge.label}</span>
                    </td>
                    <td className="max-w-md px-4 py-3 text-stone-600">
                      <span className="line-clamp-2">{summary}</span>
                      <span className="mt-0.5 block text-xs text-stone-500">
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
    </div>
  );
}
