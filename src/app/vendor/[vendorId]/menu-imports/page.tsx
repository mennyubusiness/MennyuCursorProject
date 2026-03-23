import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuImportIssueSeverity } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  vendorMenuImportListBadge,
  vendorMenuImportListBadgeClass,
} from "@/lib/vendor-menu-import-labels";

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Menu updates from Deliverect</h2>
        <p className="mt-1 text-sm text-stone-600">
          When you publish or push your menu in Deliverect, Mennyu receives a draft here. You own review and publish — no
          admin step is required for normal updates. Your live Mennyu menu (including availability) updates only after
          you publish (or after auto-publish, if you turned that on in Settings).
        </p>
        {vendor.autoPublishMenus && (
          <p className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
            <strong>Auto-publish</strong> is on: eligible Deliverect <strong>webhook</strong> imports go live
            automatically when there are no blocking issues — same safety checks as manual publish.
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Source</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
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
                return (
                <tr key={j.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-2 text-stone-700">{formatDate(j.startedAt)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-stone-600">{j.source}</td>
                  <td className="px-4 py-2">
                    <span className={vendorMenuImportListBadgeClass(badge.tone)}>{badge.label}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/vendor/${vendorId}/menu-imports/${j.id}`}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-500">
        Mennyu admins can still publish, discard, or roll back from the admin area if you need help — that path is
        optional for day-to-day menu updates.
      </p>
    </div>
  );
}
