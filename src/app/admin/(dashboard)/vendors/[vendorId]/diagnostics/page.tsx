import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { loadAdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import { loadAdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import { loadAdminVendorDetail } from "@/services/admin-vendor-detail.service";
import { evaluateVendorCustomerOrderingHoursDebug } from "@/lib/vendor-customer-ordering-hours";
import { getAdminVendorDetailTools } from "@/lib/integrations/provider-display";
import { AdminVendorTechnicalDiagnostics } from "../AdminVendorTechnicalDiagnostics";

export const dynamic = "force-dynamic";

/**
 * Level-3 technical diagnostics for engineers / advanced troubleshooting.
 * Not part of the default vendor management overview.
 */
export default async function AdminVendorDiagnosticsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const id = vendorId?.trim();
  if (!id) notFound();

  const [
    detail,
    readinessBundles,
    vendorHoursRow,
    squareStatus,
    squareInjectionDiagnostics,
  ] = await Promise.all([
    loadAdminVendorDetail(id),
    loadVendorReadinessBundles([id], { includeDeliverectMappingIntegrity: true }),
    prisma.vendor.findUnique({
      where: { id },
      select: {
        customerOrderingHours: true,
        pods: {
          take: 1,
          orderBy: { sortOrder: "asc" },
          select: { pod: { select: { pickupTimezone: true, name: true } } },
        },
      },
    }),
    loadAdminSquareRoutingStatus(id),
    loadAdminSquareOrderInjectionDiagnostics(id),
  ]);
  if (!detail) notFound();

  const posSummary = readinessBundles.get(id)?.posSummary ?? null;
  const hoursDebug = evaluateVendorCustomerOrderingHoursDebug({
    customerOrderingHours: vendorHoursRow?.customerOrderingHours,
    podPickupTimezone: vendorHoursRow?.pods[0]?.pod.pickupTimezone,
  });
  const hoursDebugPodName = vendorHoursRow?.pods[0]?.pod.name ?? null;
  const tools = getAdminVendorDetailTools(id, detail.vendor.orderRoutingMode);
  const publicPageHref = detail.pods[0]?.publicPath ?? null;

  return (
    <div className="space-y-6">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/vendors" className="hover:text-oo-charcoal hover:underline">
          Vendors
        </Link>
        <span className="mx-1.5">/</span>
        <Link
          href={`/admin/vendors/${id}`}
          className="hover:text-oo-charcoal hover:underline"
        >
          {detail.vendor.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">Technical diagnostics</span>
      </nav>

      <header className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h1 className="text-xl font-semibold text-oo-charcoal">Technical diagnostics</h1>
        <p className="mt-1 text-sm text-amber-950">
          Advanced troubleshooting view for engineers. Includes raw IDs, environment flags, OAuth
          scopes, mapping samples, and business-hours evaluation details. Use the{" "}
          <Link href={`/admin/vendors/${id}`} className="font-semibold underline">
            vendor overview
          </Link>{" "}
          for day-to-day management.
        </p>
      </header>

      <AdminVendorTechnicalDiagnostics
        detail={detail}
        posSummary={posSummary}
        squareStatus={squareStatus}
        squareInjectionDiagnostics={squareInjectionDiagnostics}
        hoursDebug={hoursDebug}
        hoursDebugPodName={hoursDebugPodName}
        tools={tools}
        publicPageHref={publicPageHref}
      />
    </div>
  );
}
