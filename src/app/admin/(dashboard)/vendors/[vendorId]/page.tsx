import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { loadAdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import { loadSquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";
import { loadAdminSquareOrderInjectionDiagnostics } from "@/lib/integrations/square/admin-square-order-injection-diagnostics.server";
import { loadAdminVendorDetail } from "@/services/admin-vendor-detail.service";
import { evaluateVendorCustomerOrderingHoursDebug } from "@/lib/vendor-customer-ordering-hours";
import { getAdminVendorDetailTools } from "@/lib/integrations/provider-display";
import { AdminVendorRescueClient } from "./AdminVendorRescueClient";

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
    squareOrderRoutingReady,
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
    loadSquareOrderRoutingReadiness(id),
    loadAdminSquareOrderInjectionDiagnostics(id),
  ]);
  if (!detail) notFound();
  const posSummary = readinessBundles.get(id)?.posSummary ?? null;
  const hoursDebug = evaluateVendorCustomerOrderingHoursDebug({
    customerOrderingHours: vendorHoursRow?.customerOrderingHours,
    podPickupTimezone: vendorHoursRow?.pods[0]?.pod.pickupTimezone,
  });
  const hoursDebugPodName = vendorHoursRow?.pods[0]?.pod.name ?? null;
  const routingMode = detail.vendor.orderRoutingMode;
  const tools = getAdminVendorDetailTools(id, routingMode);
  const publicPageHref = detail.pods[0]?.publicPath ?? null;

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

      <AdminVendorRescueClient
        detail={detail}
        podOptions={podOptions}
        posSummary={posSummary}
        squareStatus={squareStatus}
        squareOrderRoutingReady={squareOrderRoutingReady}
        squareInjectionDiagnostics={squareInjectionDiagnostics}
        hoursDebug={hoursDebug}
        hoursDebugPodName={hoursDebugPodName}
      />

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Tools</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tools.map((tool) => (
            <li key={tool.href}>
              <Link
                href={tool.href}
                className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
              >
                <span className="font-medium text-oo-charcoal">{tool.title}</span>
                <span className="mt-1 text-sm text-oo-stone-gray">{tool.description}</span>
              </Link>
            </li>
          ))}
          {publicPageHref ? (
            <li>
              <a
                href={publicPageHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm hover:bg-oo-cream/80"
              >
                <span className="font-medium text-oo-charcoal">Public page</span>
                <span className="mt-1 text-sm text-oo-stone-gray">Customer-facing vendor menu and ordering</span>
              </a>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
