import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { loadAdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import { loadAdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import { loadAdminVendorDetail } from "@/services/admin-vendor-detail.service";
import { evaluateVendorCustomerOrderingHoursDebug } from "@/lib/vendor-customer-ordering-hours";
import { buildAdminVendorSummary } from "@/lib/admin-vendor-summary";
import { buildVendorPosReadinessFallback } from "@/lib/pos-connection-status";
import { AdminVendorOverview } from "./AdminVendorOverview";

export const dynamic = "force-dynamic";

export default async function AdminVendorDetailPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const id = vendorId?.trim();
  if (!id) notFound();

  const [
    detail,
    podOptions,
    readinessBundles,
    vendorHoursRow,
    squareStatus,
    squareInjectionDiagnostics,
  ] = await Promise.all([
    loadAdminVendorDetail(id),
    prisma.pod.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
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

  const posSummary =
    readinessBundles.get(id)?.posSummary ??
    buildVendorPosReadinessFallback({
      posConnectionStatus: detail.vendor.posConnectionStatus,
      deliverectChannelLinkId: detail.vendor.deliverectChannelLinkId,
      orderRoutingMode: detail.vendor.orderRoutingMode,
      menuSource: detail.vendor.menuSource,
    });
  const hoursDebug = evaluateVendorCustomerOrderingHoursDebug({
    customerOrderingHours: vendorHoursRow?.customerOrderingHours,
    podPickupTimezone: vendorHoursRow?.pods[0]?.pod.pickupTimezone,
  });

  const summary = buildAdminVendorSummary({
    detail,
    posSummary,
    squareStatus,
    squareInjectionDiagnostics,
    hoursDebug,
  });

  return (
    <div className="space-y-6">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/vendors" className="hover:text-oo-charcoal hover:underline">
          Vendors
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{detail.vendor.name}</span>
      </nav>

      <AdminVendorOverview
        summary={summary}
        detail={detail}
        podOptions={podOptions}
        posSummary={posSummary}
        squareStatus={squareStatus}
      />
    </div>
  );
}
