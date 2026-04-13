import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { fetchVendorMenuVersionHistoryForAdmin } from "@/lib/admin-vendor-menu-history-queries";
import { VendorImportsSection } from "./VendorImportsSection";
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
    <div className="space-y-10">
      <div>
        <p className="text-sm text-stone-500">
          <Link href="/admin/vendors" className="hover:underline">
            Vendors
          </Link>
          <span className="mx-1">/</span>
          <Link href={`/admin/vendors/${vendor.id}`} className="hover:underline">
            {vendor.name}
          </Link>
          <span className="mx-1">/</span>
          <span className="text-stone-800">Menu</span>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">Menu management</h1>
        <p className="mt-2 max-w-2xl text-sm text-stone-600">
          Deliverect imports, draft review, and published menu snapshots for <strong>{vendor.name}</strong>.
        </p>
      </div>

      <VendorImportsSection vendorId={vendor.id} vendorName={vendor.name} />

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
