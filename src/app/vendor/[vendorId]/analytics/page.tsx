import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getVendorAnalytics } from "@/services/vendor-analytics.service";
import { VendorAnalyticsSection } from "../dashboard/VendorAnalyticsSection";

export default async function VendorAnalyticsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) notFound();

  const analytics = await getVendorAnalytics(vendorId);
  const hasAnyData =
    analytics.today.orders > 0 || analytics.last7.orders > 0 || analytics.topItems.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Analytics</h2>
        <p className="mt-1 text-sm text-stone-600">
          Orders and revenue by period, plus top items.
        </p>
      </div>

      {hasAnyData ? (
        <VendorAnalyticsSection data={analytics} />
      ) : (
        <div className="rounded-xl border border-stone-200 bg-stone-50/50 px-6 py-10 text-center">
          <p className="font-medium text-stone-700">No analytics yet</p>
          <p className="mt-1 text-sm text-stone-500">
            Completed orders will show up here (today, last 7 days, top items).
          </p>
        </div>
      )}
    </div>
  );
}
