import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuImportIssueSeverity, MenuImportSource } from "@prisma/client";
import { prisma } from "@/lib/db";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
}

function jobStatusBadge(status: string, blocking: number, source: string) {
  if (status === "succeeded") {
    return <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-900">Published</span>;
  }
  if (status === "awaiting_review") {
    if (blocking > 0) {
      return <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Blocked · review</span>;
    }
    return <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">Awaiting review</span>;
  }
  if (status === "failed") {
    return <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-900">Failed</span>;
  }
  if (source === MenuImportSource.DELIVERECT_MENU_WEBHOOK) {
    return <span className="rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-900">Webhook</span>;
  }
  return <span className="font-mono text-xs text-stone-600">{status}</span>;
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
      startedAt: true,
      completedAt: true,
      draftVersionId: true,
      issues: {
        where: { severity: MenuImportIssueSeverity.blocking, waived: false },
        select: { id: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Menu imports</h2>
        <p className="mt-1 text-sm text-stone-600">
          Deliverect pushes menu updates here as drafts. Review the diff, then publish to update your live Mennyu menu
          (including availability/snooze).
        </p>
        {vendor.autoPublishMenus && (
          <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <strong>Auto-publish</strong> is on: eligible webhook imports publish automatically when there are no
            blocking issues.
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
              jobs.map((j) => (
                <tr key={j.id} className="hover:bg-stone-50">
                  <td className="whitespace-nowrap px-4 py-2 text-stone-700">{formatDate(j.startedAt)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-stone-600">{j.source}</td>
                  <td className="px-4 py-2">
                    {jobStatusBadge(j.status, j.issues.length, j.source)}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-stone-500">
        Admins can also manage imports under <span className="font-mono">/admin/menu-imports</span>.
      </p>
    </div>
  );
}
