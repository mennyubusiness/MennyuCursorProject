import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DeliverectMenuHealthPanel } from "@/components/deliverect/DeliverectMenuHealthPanel";
import { prisma } from "@/lib/db";
import { evaluateDeliverectMenuIntegrityForVendor } from "@/services/deliverect-menu-integrity.service";
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
        deliverectChannelLinkId: true,
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

  const deliverectMenuIntegrity =
    vendor.deliverectChannelLinkId?.trim() != null && vendor.deliverectChannelLinkId.trim() !== ""
      ? await evaluateDeliverectMenuIntegrityForVendor(vendorId)
      : null;

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
    <div className="space-y-10">
      <header>
        <h2 className="text-xl font-semibold text-stone-900">Settings</h2>
        <p className="mt-1 text-sm text-stone-500">Profile, orders, menu, and sign-in.</p>
      </header>

      <Suspense fallback={null}>
        <VendorAccessQueryMessages />
      </Suspense>

      {/* Brand / profile */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Brand &amp; profile</h3>
          <p className="mt-1 text-sm text-stone-500">Name, logo, and colors on the pod and customer menu.</p>
          <p className="mt-1 text-xs text-stone-400">
            URL slug: <span className="font-mono text-stone-600">{vendor.slug}</span> (fixed)
          </p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <VendorBrandProfileForm
            vendorId={vendor.id}
            initialName={vendor.name}
            initialDescription={vendor.description}
            initialImageUrl={vendor.imageUrl}
            initialAccentColor={vendor.accentColor}
          />
        </div>
      </section>

      {/* Ordering & availability */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Ordering &amp; availability</h3>
          <p className="mt-1 text-sm text-stone-500">Stop or resume new Mennyu orders.</p>
        </div>
        <VendorPauseToggle vendorId={vendor.id} initialPaused={vendor.mennyuOrdersPaused ?? false} embedded />
        <p className="text-xs text-stone-400">
          You can also pause from{" "}
          <Link href={`/vendor/${vendorId}/orders`} className="text-stone-600 underline hover:text-stone-800">
            Orders
          </Link>
          .
        </p>
      </section>

      {/* Menu publishing */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-stone-900">Menu publishing</h3>
          <p className="mt-1 text-sm text-stone-500">How Deliverect menu updates go live.</p>
        </div>
        <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <VendorAutoPublishToggle vendorId={vendor.id} initialAutoPublishMenus={vendor.autoPublishMenus ?? false} />
        </div>
      </section>

      {deliverectMenuIntegrity && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-900">Kitchen POS (Deliverect)</h3>
            <p className="mt-1 text-sm text-stone-500">
              Mapping health for orders sent to the kitchen. Contact Mennyu support if you see critical issues.
            </p>
          </div>
          <DeliverectMenuHealthPanel report={deliverectMenuIntegrity} title="Menu mapping health" />
        </section>
      )}

      {/* Pod membership */}
      <section className="space-y-4">
        <VendorPodRequests
          vendorId={vendor.id}
          requests={pendingRequestsForComponent}
          currentPod={currentPod ? { id: currentPod.pod.id, name: currentPod.pod.name } : null}
        />
        <VendorRecentPodRequests recentRequests={recentRequestsForComponent} />
      </section>

      {/* Access / sign-in */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-stone-900">Access &amp; sign-in</h3>
        <VendorDashboardAccessCard vendorId={vendor.id} hasDashboardSecret={hasToken} />
      </section>

      {/* Advanced */}
      <details className="rounded-xl border border-stone-200 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-5 py-4 text-lg font-semibold text-stone-900 marker:hidden [&::-webkit-details-marker]:hidden">
          Advanced
        </summary>
        <div className="space-y-5 border-t border-stone-100 px-5 pb-5 pt-4">
          <p className="text-sm text-stone-600">
            <span className="font-medium text-stone-800">Integrations:</span> POS / Deliverect connection coming soon.
            Orders stay in Mennyu until then.
          </p>
          <VendorAdvancedAccessSection vendorId={vendor.id} hasDashboardToken={hasToken} />
        </div>
      </details>
    </div>
  );
}
