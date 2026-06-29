import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { loadAdminVendorDetail } from "@/services/admin-vendor-detail.service";
import { AdminVendorRescueClient } from "./AdminVendorRescueClient";

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const id = vendorId?.trim();
  if (!id) notFound();

  const [detail, podOptions, readinessBundles] = await Promise.all([
    loadAdminVendorDetail(id),
    prisma.pod.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
    loadVendorReadinessBundles([id]),
  ]);
  if (!detail) notFound();
  const posSummary = readinessBundles.get(id)?.posSummary ?? null;

  return (
    <div className="space-y-8">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/vendors" className="hover:text-oo-charcoal hover:underline">
          Vendors
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{detail.vendor.name}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{detail.vendor.name}</h1>
        <p className="mt-1 font-mono text-sm text-oo-stone-gray">{detail.vendor.slug}</p>
      </header>

      <AdminVendorRescueClient detail={detail} podOptions={podOptions} posSummary={posSummary} />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Tools</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href={`/admin/vendors/${id}/menu-history`}
              className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
            >
              <span className="font-medium text-oo-charcoal">Menu management</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Deliverect imports, publish/discard, snapshots</span>
            </Link>
          </li>
          <li>
            <Link
              href={`/admin/vendors/${id}/deliverect-mapping`}
              className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
            >
              <span className="font-medium text-oo-charcoal">POS &amp; Deliverect IDs</span>
              <span className="mt-1 text-sm text-oo-stone-gray">Channel mapping and POS health</span>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
