import "server-only";

import { cache } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import {
  derivePodAttentionItems,
  isPodSetupComplete,
} from "@/lib/pod-dashboard-attention";
import { derivePodDashboardLayoutState } from "@/lib/pod-dashboard-layout";
import { resolvePodDashboardAnnouncementState } from "@/lib/pod-announcement";
import {
  buildPodAdoptionAttentionRows,
  computePodLaunchReadinessSummary,
} from "@/lib/pod-vendor-adoption";
import { derivePodSetupChecklist, deriveVendorPodReadinessForRoster } from "@/lib/vendor-pod-readiness";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import { loadVendorDeliverectMappingReadyMap } from "@/services/vendor-deliverect-mapping-readiness.server";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { getPodAnalytics } from "@/services/pod-analytics.service";
import { getPodActivityFeed } from "@/services/pod-activity.service";
import { listPendingPodVendorInvites } from "@/services/pod-vendor-invite.service";
import { getPodOwnerPayoutSummary } from "@/services/pod-payout-summary.service";
import { loadPodPayoutRecipientContext } from "@/services/pod-payout-connect.service";
import type { PodRosterVendorRow } from "@/app/pod/[podId]/dashboard/PodVendorRosterPanel";

export type PodDashboardContext = NonNullable<Awaited<ReturnType<typeof loadPodDashboardContext>>>;

export const loadPodDashboardContext = cache(async (podId: string) => {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      imageUrl: true,
      address: true,
      isActive: true,
      announcementText: true,
      announcementIsActive: true,
      pickupInstructions: true,
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
              orderRoutingMode: true,
              customerOrderingHours: true,
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { vendorId: "asc" }],
      },
    },
  });
  if (!pod) return null;

  const vendorIdsInPod = pod.vendors.map((pv) => pv.vendor.id);
  const session = await auth();
  const viewerUserId = session?.user?.id;

  const [
    pendingRequests,
    pendingEmailInvites,
    menuSummaries,
    unmatchedFlags,
    analytics,
    payoutSummary,
    payoutContext,
  ] = await Promise.all([
    prisma.podMembershipRequest.findMany({
      where: { podId, status: "pending" },
      include: {
        vendor: {
          select: { id: true, name: true, description: true, imageUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    listPendingPodVendorInvites(podId),
    loadVendorMenuReadinessSummaries(vendorIdsInPod),
    Promise.all(
      vendorIdsInPod.map(async (vendorId) => ({
        vendorId,
        hasUnmatched: await hasUnmatchedChannelRegistrationForVendorById(vendorId),
      }))
    ),
    getPodAnalytics(podId),
    viewerUserId ? getPodOwnerPayoutSummary(podId, viewerUserId) : Promise.resolve(null),
    loadPodPayoutRecipientContext(podId),
  ]);

  if (!analytics) return null;

  const unmatchedByVendor = new Map(unmatchedFlags.map((row) => [row.vendorId, row.hasUnmatched]));
  const routingModes = new Map<string, VendorOrderRoutingMode>(
    pod.vendors.map((pv) => [pv.vendor.id, pv.vendor.orderRoutingMode])
  );
  const mappingReadyByVendor = await loadVendorDeliverectMappingReadyMap(vendorIdsInPod, routingModes);
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
        orderRoutingMode: vendor.orderRoutingMode,
        deliverectMappingReady: mappingReadyByVendor.get(vendor.id) ?? true,
      },
      stripeSummary: {
        stripeConnectedAccountId: vendor.stripeConnectedAccountId,
        stripeChargesEnabled: vendor.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: vendor.stripePayoutsEnabled ?? false,
        stripeConnectConfigured,
      },
      customerOrderingHours: vendor.customerOrderingHours,
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
      orderRoutingMode: vendor.orderRoutingMode,
      readiness: {
        status: readiness.status,
        label: readiness.label,
        description: readiness.description,
        canAcceptOrders: readiness.canAcceptOrders,
        orderRoutingMode: vendor.orderRoutingMode,
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
      slug: pod.slug,
      pickupInstructions: pod.pickupInstructions,
    },
    vendorStatuses: rosterRows.map((row) => ({
      status: row.readiness.status,
      canAcceptOrders: row.readiness.canAcceptOrders,
    })),
    podPayoutsEnabled: payoutContext?.podPayoutsEnabled ?? false,
    payoutSetupReady: payoutSummary?.payoutSetupReady ?? false,
  });

  const setupComplete = isPodSetupComplete(
    podSetupChecklist.filter((item) => item.complete).map((item) => item.key)
  );

  const pendingInviteVendorIds = new Set(
    pendingEmailInvites.map((invite) => invite.targetVendorId).filter((id): id is string => Boolean(id))
  );

  const pendingForUi = pendingRequests
    .filter((r) => !pendingInviteVendorIds.has(r.vendor.id))
    .map((r) => ({
      id: r.id,
      vendorId: r.vendor.id,
      vendorName: r.vendor.name,
      vendorDescription: r.vendor.description,
      vendorImageUrl: r.vendor.imageUrl,
      createdAt: r.createdAt.toISOString(),
    }));

  const orderableVendorCount = rosterRows.filter((row) => row.readiness.canAcceptOrders).length;
  const launchSummary = computePodLaunchReadinessSummary(rosterRows);
  const adoptionAttentionRows = buildPodAdoptionAttentionRows(rosterRows);
  const layout = derivePodDashboardLayoutState({
    vendorCount: rosterRows.length,
    podSetupChecklist,
    adoptionAttentionRows,
  });

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

  const publicPageHref = buildPodCustomerPath(pod.slug);
  const attentionItems = derivePodAttentionItems({
    podId: pod.id,
    orderableVendorCount,
    vendorCount: rosterRows.length,
    addressSet: Boolean(pod.address?.trim()),
    pendingInviteCount: pendingEmailInvites.length,
    pendingRequestCount: pendingForUi.length,
    adoptionAttentionRows,
    incompleteSetupItems: podSetupChecklist.filter(
      (item) =>
        !item.complete && item.owner === "pod_owner" && item.key !== "payout_setup"
    ),
  });

  return {
    pod,
    rosterRows,
    pendingForUi,
    pendingEmailInvites,
    analytics,
    payoutSummary,
    payoutContext,
    podSetupChecklist,
    setupComplete,
    orderableVendorCount,
    launchSummary,
    adoptionAttentionRows,
    layout,
    activityFeed,
    featuredVendors,
    announcementState,
    publicPageHref,
    attentionItems,
  };
});
