import { Suspense } from "react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { VendorPauseToggle } from "../dashboard/VendorPauseToggle";
import { VendorPodRequests } from "../dashboard/VendorPodRequests";
import { VendorRecentPodRequests } from "../dashboard/VendorRecentPodRequests";
import { VendorAutoPublishToggle } from "./VendorAutoPublishToggle";
import { VendorDashboardAccessCard } from "./VendorDashboardAccessCard";
import { VendorAccessQueryMessages } from "./VendorAccessMessages";
import { VendorAdvancedAccessSection } from "./VendorAdvancedAccessSection";
import { VendorBrandProfileForm } from "./VendorBrandProfileForm";

export default async function VendorSettingsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const [vendor, pendingRequests, recentRequests, currentPod] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: vendorId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        imageUrl: true,
        accentColor: true,
        mennyuOrdersPaused: true,
        autoPublishMenus: true,
        vendorDashboardToken: true,
      },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: "pending" },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { vendorId, status: { not: "pending" } },
      include: { pod: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.podVendor.findFirst({
      where: { vendorId },
      include: { pod: { select: { id: true, name: true } } },
    }),
  ]);

  if (!vendor) notFound();

  const pendingRequestsForComponent = pendingRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    createdAt: r.createdAt.toISOString(),
  }));

  const recentRequestsForComponent = recentRequests.map((r) => ({
    id: r.id,
    podId: r.pod.id,
    podName: r.pod.name,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
  }));

  const hasToken = Boolean(vendor.vendorDashboardToken?.trim());

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-stone-900">Settings</h2>
        <p className="mt-1 text-sm text-stone-600">
          Vendor profile, Mennyu controls, and how you sign in.
        </p>
      </div>

      <VendorDashboardAccessCard vendorId={vendor.id} hasDashboardSecret={hasToken} />

      <Suspense fallback={null}>
        <VendorAccessQueryMessages />
      </Suspense>

      {/* Brand / profile (customer-facing) */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Brand / profile</h3>
        <p className="mt-1 text-sm text-stone-600">
          How your restaurant appears on the pod page and when customers open your menu.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Internal slug: <span className="font-mono text-stone-700">{vendor.slug}</span> (not editable here)
        </p>
        <div className="mt-4">
          <VendorBrandProfileForm
            vendorId={vendor.id}
            initialName={vendor.name}
            initialDescription={vendor.description}
            initialImageUrl={vendor.imageUrl}
            initialAccentColor={vendor.accentColor}
          />
        </div>
      </section>

      {/* Mennyu settings */}
      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Mennyu settings
        </h3>
        <div className="mt-3">
          <VendorPauseToggle vendorId={vendor.id} initialPaused={vendor.mennyuOrdersPaused ?? false} />
        </div>
        <p className="mt-3 text-xs text-stone-400">
          You can also pause or resume Mennyu orders from the{" "}
          <Link href={`/vendor/${vendorId}/orders`} className="underline hover:text-stone-600">
            Orders
          </Link>{" "}
          page.
        </p>
      </section>

      <VendorAutoPublishToggle vendorId={vendor.id} initialAutoPublishMenus={vendor.autoPublishMenus ?? false} />

      {/* Pending pod requests */}
      <VendorPodRequests
        vendorId={vendor.id}
        requests={pendingRequestsForComponent}
        currentPod={currentPod ? { id: currentPod.pod.id, name: currentPod.pod.name } : null}
      />

      {/* Recent pod requests */}
      <VendorRecentPodRequests recentRequests={recentRequestsForComponent} />

      <VendorAdvancedAccessSection vendorId={vendor.id} hasDashboardToken={hasToken} />

      {/* Integrations placeholder */}
      <section className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Integrations
        </h3>
        <p className="mt-3 text-sm text-stone-600">
          POS / Deliverect connection coming soon. Your orders are managed in Mennyu until then.
        </p>
      </section>
    </div>
  );
}
