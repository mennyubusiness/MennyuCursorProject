import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { derivePodSetupChecklist, deriveVendorPodReadinessForRoster } from "@/lib/vendor-pod-readiness";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { getPodAnalytics } from "@/services/pod-analytics.service";
import { getPodActivityFeed } from "@/services/pod-activity.service";
import {
  buildPodAdoptionAttentionRows,
  computePodLaunchReadinessSummary,
} from "@/lib/pod-vendor-adoption";
import { resolvePodDashboardAnnouncementState } from "@/lib/pod-announcement";
import { PodDashboardActivityFeed } from "./PodDashboardActivityFeed";
import { PodDashboardInviteVendorSection } from "./PodDashboardInviteVendorSection";
import { PodDashboardMetrics } from "./PodDashboardMetrics";
import { PodDashboardPendingRequests } from "./PodDashboardPendingRequests";
import { PodDashboardQuickActions } from "./PodDashboardQuickActions";
import { PodPromotionCard } from "./PodPromotionCard";
import { PodDashboardSetupChecklist } from "./PodDashboardSetupChecklist";
import { PodVendorAdoptionBoard } from "./PodVendorAdoptionBoard";
import { PodVendorRosterPanel, type PodRosterVendorRow } from "./PodVendorRosterPanel";

export default async function PodDashboardPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      address: true,
      pickupInstructions: true,
      isActive: true,
      announcementText: true,
      announcementIsActive: true,
      vendors: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              imageUrl: true,
              cuisineCategory: true,
              contactEmail: true,
              contactPhone: true,
              isActive: true,
              mennyuOrdersPaused: true,
              stripeConnectedAccountId: true,
              stripeChargesEnabled: true,
              stripePayoutsEnabled: true,
              deliverectChannelLinkId: true,
              posConnectionStatus: true,
              pendingDeliverectConnectionKey: true,
              deliverectAutoMapLastOutcome: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { vendorId: "asc" }],
      },
    },
  });
  if (!pod) notFound();

  const vendorIdsInPod = pod.vendors.map((pv) => pv.vendor.id);
  const [vendorsNotInPod, pendingRequests, menuSummaries, unmatchedFlags, analytics] = await Promise.all([
    prisma.vendor.findMany({
      where: { id: { notIn: vendorIdsInPod } },
      select: { id: true, name: true, slug: true, isActive: true, mennyuOrdersPaused: true },
      orderBy: { name: "asc" },
    }),
    prisma.podMembershipRequest.findMany({
      where: { podId, status: "pending" },
      include: {
        vendor: {
          select: { id: true, name: true, description: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    loadVendorMenuReadinessSummaries(vendorIdsInPod),
    Promise.all(
      vendorIdsInPod.map(async (vendorId) => ({
        vendorId,
        hasUnmatched: await hasUnmatchedChannelRegistrationForVendorById(vendorId),
      }))
    ),
    getPodAnalytics(podId),
  ]);
  if (!analytics) notFound();
  const unmatchedByVendor = new Map(unmatchedFlags.map((row) => [row.vendorId, row.hasUnmatched]));
  const stripeConnectConfigured = Boolean(env.STRIPE_SECRET_KEY);

  const rosterRows: PodRosterVendorRow[] = pod.vendors.map((pv) => {
    const vendor = pv.vendor;
    const readiness = deriveVendorPodReadinessForRoster({
      podId: pod.id,
      podSlug: pod.slug,
      vendorId: vendor.id,
      pod: { isActive: pod.isActive },
      podVendor: { isActive: pv.isActive },
      vendor: {
        isActive: vendor.isActive,
        mennyuOrdersPaused: vendor.mennyuOrdersPaused ?? false,
        name: vendor.name,
        slug: vendor.slug,
        description: vendor.description,
        imageUrl: vendor.imageUrl,
        cuisineCategory: vendor.cuisineCategory,
        contactEmail: vendor.contactEmail,
        contactPhone: vendor.contactPhone,
      },
      menuSummary: menuSummaries.get(vendor.id) ?? {
        hasPublishedMenuVersion: false,
        hasOperationalItems: false,
        hasAvailableOperationalItems: false,
      },
      posSummary: {
        deliverectChannelLinkId: vendor.deliverectChannelLinkId,
        posConnectionStatus: vendor.posConnectionStatus,
        deliverectAutoMapLastOutcome: vendor.deliverectAutoMapLastOutcome,
        pendingDeliverectConnectionKey: vendor.pendingDeliverectConnectionKey,
        hasUnmatchedChannelRegistration: unmatchedByVendor.get(vendor.id) ?? false,
      },
      stripeSummary: {
        stripeConnectedAccountId: vendor.stripeConnectedAccountId,
        stripeChargesEnabled: vendor.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: vendor.stripePayoutsEnabled ?? false,
        stripeConnectConfigured,
      },
    });

    return {
      vendorId: vendor.id,
      vendorSlug: vendor.slug,
      name: vendor.name,
      description: vendor.description,
      imageUrl: vendor.imageUrl,
      isFeatured: pv.isFeatured,
      podVendorActive: pv.isActive,
      vendorGloballyActive: vendor.isActive,
      mennyuOrdersPaused: vendor.mennyuOrdersPaused ?? false,
      readiness: {
        status: readiness.status,
        label: readiness.label,
        description: readiness.description,
        canAcceptOrders: readiness.canAcceptOrders,
        setupSummary: readiness.setupSummary,
        primaryBlocker: readiness.blockingReasons[0]
          ? {
              code: readiness.blockingReasons[0].code,
              label: readiness.blockingReasons[0].label,
              description: readiness.blockingReasons[0].description,
              owner: readiness.blockingReasons[0].owner,
            }
          : null,
      },
    };
  });

  const podSetupChecklist = derivePodSetupChecklist({
    podId: pod.id,
    pod: {
      isActive: pod.isActive,
      name: pod.name,
      description: pod.description,
      imageUrl: pod.imageUrl,
      address: pod.address,
      pickupInstructions: pod.pickupInstructions,
    },
    vendorStatuses: rosterRows.map((row) => ({
      status: row.readiness.status,
      canAcceptOrders: row.readiness.canAcceptOrders,
    })),
  });

  const pendingForUi = pendingRequests.map((r) => ({
    id: r.id,
    vendorId: r.vendor.id,
    vendorName: r.vendor.name,
    vendorDescription: r.vendor.description,
    vendorImageUrl: r.vendor.imageUrl,
    createdAt: r.createdAt.toISOString(),
  }));

  const orderableVendorCount = rosterRows.filter((row) => row.readiness.canAcceptOrders).length;
  const demoteSetupChecklist = pod.isActive && orderableVendorCount > 0;
  const launchSummary = computePodLaunchReadinessSummary(rosterRows);
  const adoptionAttentionRows = buildPodAdoptionAttentionRows(rosterRows);
  const activityFeed = await getPodActivityFeed(podId, {
    roster: rosterRows.map((row) => ({
      vendorId: row.vendorId,
      name: row.name,
      podVendorActive: row.podVendorActive,
      vendorGloballyActive: row.vendorGloballyActive,
      readiness: {
        status: row.readiness.status,
        canAcceptOrders: row.readiness.canAcceptOrders,
      },
    })),
    ordersToday: analytics.summary.ordersToday,
  });

  const featuredVendors = rosterRows
    .filter((row) => row.isFeatured && row.podVendorActive)
    .map((row) => ({ vendorId: row.vendorId, name: row.name }));

  const announcementState = resolvePodDashboardAnnouncementState(
    pod.announcementText,
    pod.announcementIsActive
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-oo-charcoal">{pod.name}</h1>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Track Open Order at your pod, promote your public pod page, and keep vendors ready for customers.
        </p>
      </div>

      <PodDashboardMetrics summary={analytics.summary} orderableVendorCount={orderableVendorCount} />

      <PodDashboardQuickActions podId={pod.id} podSlug={pod.slug} />

      <PodVendorAdoptionBoard
        podSlug={pod.slug}
        launchSummary={launchSummary}
        attentionRows={adoptionAttentionRows}
        pendingCount={pendingForUi.length}
      />

      <PodDashboardActivityFeed podId={pod.id} podSlug={pod.slug} feed={activityFeed} />

      <PodPromotionCard
        podId={pod.id}
        podSlug={pod.slug}
        initialText={announcementState.initialText}
        initialIsActive={announcementState.initialIsActive}
        featuredVendors={featuredVendors}
      />

      <PodDashboardSetupChecklist items={podSetupChecklist} demoted={demoteSetupChecklist} />

      <PodDashboardPendingRequests podId={pod.id} requests={pendingForUi} />

      <PodDashboardInviteVendorSection
        podId={pod.id}
        collapsedByDefault={demoteSetupChecklist}
        eligibleVendors={vendorsNotInPod.map((v) => ({
          id: v.id,
          name: v.name,
          slug: v.slug,
          isActive: v.isActive,
          mennyuOrdersPaused: v.mennyuOrdersPaused ?? false,
        }))}
      />

      <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Vendor roster</h2>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Set the order vendors appear on your public pod page. Use Featured in each row to highlight a vendor.
          Stripe and menu setup are completed by the vendor — you can pause visibility anytime.
        </p>
        <div className="mt-4">
          <PodVendorRosterPanel podId={pod.id} podSlug={pod.slug} initialRows={rosterRows} />
        </div>
      </section>
    </div>
  );
}
