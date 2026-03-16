import { cache } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { VendorAvailabilityStatusSection } from "../dashboard/VendorAvailabilityStatusSection";
import { VendorPauseToggle } from "../dashboard/VendorPauseToggle";
import { VendorDashboardLiveOrders } from "../dashboard/VendorDashboardLiveOrders";

const getVendorOrdersPageData = cache(async (vendorId: string) => {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true, mennyuOrdersPaused: true },
  });
  if (!vendor) return null;
  const vendorOrders = await prisma.vendorOrder.findMany({
    where: { vendorId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      manuallyRecoveredAt: true,
      totalCents: true,
      order: {
        select: {
          id: true,
          orderNotes: true,
          createdAt: true,
          _count: { select: { vendorOrders: true } },
        },
      },
      lineItems: {
        select: {
          id: true,
          name: true,
          quantity: true,
          priceCents: true,
          specialInstructions: true,
          selections: {
            select: {
              nameSnapshot: true,
              quantity: true,
              modifierOption: { select: { name: true } },
            },
          },
        },
      },
      statusHistory: { orderBy: { createdAt: "asc" }, select: { source: true, fulfillmentStatus: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return { vendor, vendorOrders };
});

export default async function VendorOrdersPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const data = await getVendorOrdersPageData(vendorId);
  if (!data) notFound();
  const { vendor, vendorOrders } = data;

  const initialVendorOrdersForClient = vendorOrders.map((vo) => ({
    ...vo,
    manuallyRecoveredAt: vo.manuallyRecoveredAt?.toISOString() ?? null,
    order: {
      ...vo.order,
      createdAt: vo.order.createdAt.toISOString(),
    },
    statusHistory: vo.statusHistory.map((h) => ({
      ...h,
      createdAt: h.createdAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Orders</h2>
        <p className="mt-1 text-sm text-stone-600">
          Manage incoming orders, status, and pickup.
        </p>
      </div>

      <VendorAvailabilityStatusSection
        posOpen={undefined}
        mennyuOrdersPaused={vendor.mennyuOrdersPaused ?? false}
      />

      <VendorPauseToggle
        vendorId={vendor.id}
        initialPaused={vendor.mennyuOrdersPaused ?? false}
      />

      <VendorDashboardLiveOrders vendorId={vendor.id} initialVendorOrders={initialVendorOrdersForClient} />
    </div>
  );
}
