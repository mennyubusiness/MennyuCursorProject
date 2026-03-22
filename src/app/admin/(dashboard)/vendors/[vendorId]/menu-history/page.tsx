import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchVendorMenuVersionHistoryForAdmin } from "@/lib/admin-vendor-menu-history-queries";
import { VendorMenuHistoryClient, type MenuHistoryRowClient } from "./VendorMenuHistoryClient";

export default async function AdminVendorMenuHistoryPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  if (!vendorId?.trim()) notFound();

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId.trim() },
    select: { id: true, name: true, slug: true },
  });
  if (!vendor) notFound();

  const history = await fetchVendorMenuVersionHistoryForAdmin(vendor.id);
  const currentPublished = history.find((r) => r.state === MenuVersionState.published);
  const currentPublishedId = currentPublished?.id ?? null;

  const rows: MenuHistoryRowClient[] = history.map((r) => ({
    id: r.id,
    state: r.state,
    publishedAtIso: r.publishedAt?.toISOString() ?? null,
    publishedBy: r.publishedBy,
    restoredFromMenuVersionId: r.restoredFromMenuVersionId,
    createdAtIso: r.createdAt.toISOString(),
    summary: r.summary,
    summaryParseError: r.summaryParseError,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/vendors" className="text-sm text-stone-600 hover:underline">
          ← Vendors
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-stone-900">Published menu history</h1>
        <p className="mt-0.5 font-mono text-sm text-stone-600">{vendor.name}</p>
      </div>

      <VendorMenuHistoryClient
        vendorId={vendor.id}
        vendorName={vendor.name}
        currentPublishedId={currentPublishedId}
        rows={rows}
        adminSecret={env.ADMIN_SECRET?.trim() ?? null}
      />
    </div>
  );
}
