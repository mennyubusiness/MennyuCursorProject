import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import { getVendorAvailability } from "@/lib/vendor-availability";
import {
  deriveVendorAttentionItems,
  isVendorSetupComplete,
} from "@/lib/vendor-dashboard-attention";
import {
  vendorIntakeStatusLabel,
  vendorMenuSyncLabel,
  vendorPaymentsReadinessLabel,
  vendorPosConnectionLabel,
} from "@/lib/vendor-operational-copy";
import { loadVendorMenuReadinessSummaries } from "@/lib/vendor-menu-readiness.server";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import {
  deriveVendorPodReadiness,
  isVendorMenuReady,
  isVendorStripePayoutReady,
} from "@/lib/vendor-pod-readiness";
import {
  countActiveBoardGroups,
  groupVendorOrdersForBoard,
} from "@/lib/vendor-orders-board";
import { hasUnmatchedChannelRegistrationForVendorById } from "@/services/deliverect-channel-registration-retry.service";
import { getVendorOrdersBoardData, serializeVendorOrdersForBoard } from "@/lib/vendor-orders-board-data";
import { summarizeVendorCustomerOrderingHours } from "@/lib/vendor-customer-ordering-hours";
import { resolveVendorHoursTimezone } from "@/lib/vendor-customer-ordering-hours";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type VendorDashboardContext = NonNullable<Awaited<ReturnType<typeof loadVendorDashboardContext>>>;

export const loadVendorDashboardContext = cache(async (vendorId: string) => {
  const vendorRecord = await prisma.vendor.findUnique({
    where: { id: vendorId },
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
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
      posConnectionStatus: true,
      pendingDeliverectConnectionKey: true,
      deliverectAutoMapLastOutcome: true,
      deliverectAutoMapLastAt: true,
      stripeConnectedAccountId: true,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: true,
      syncCustomerOrderingHoursFromDeliverect: true,
      customerOrderingHours: true,
      deliverectSyncedCustomerOrderingHours: true,
    },
  });
  if (!vendorRecord) return null;

  const [boardData, pendingInvites, currentPod, hasUnmatchedChannelRegistration, menuSummaries, todayStats] =
    await Promise.all([
      getVendorOrdersBoardData(vendorId),
      prisma.podMembershipRequest.count({ where: { vendorId, status: "pending" } }),
      prisma.podVendor.findFirst({
        where: { vendorId },
        select: {
          isActive: true,
          pod: { select: { id: true, name: true, slug: true, isActive: true, pickupTimezone: true } },
        },
      }),
      hasUnmatchedChannelRegistrationForVendorById(vendorId),
      loadVendorMenuReadinessSummaries([vendorId]),
      loadVendorTodayPerformance(vendorId),
    ]);

  if (!boardData) return null;

  const menuSummary = menuSummaries.get(vendorId) ?? {
    hasPublishedMenuVersion: false,
    hasOperationalItems: false,
    hasAvailableOperationalItems: false,
  };

  const posState = deriveVendorPosUiState({
    deliverectChannelLinkId: vendorRecord.deliverectChannelLinkId,
    posConnectionStatus: vendorRecord.posConnectionStatus,
    deliverectAutoMapLastOutcome: vendorRecord.deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey: vendorRecord.pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: hasUnmatchedChannelRegistration,
  });
  const posConnected = posState === "connected";
  const paymentsReady = isVendorStripePayoutReady({
    stripeConnectedAccountId: vendorRecord.stripeConnectedAccountId,
    stripeChargesEnabled: vendorRecord.stripeChargesEnabled ?? false,
    stripePayoutsEnabled: vendorRecord.stripePayoutsEnabled ?? false,
    stripeConnectConfigured: Boolean(env.STRIPE_SECRET_KEY),
  });
  const menuReady = isVendorMenuReady(menuSummary);

  const readiness = deriveVendorPodReadiness(
    {
      podId: currentPod?.pod.id ?? vendorId,
      vendorId,
      pod: { isActive: currentPod?.pod.isActive ?? true },
      podVendor: currentPod ? { isActive: currentPod.isActive } : null,
      vendor: {
        isActive: vendorRecord.isActive,
        mennyuOrdersPaused: vendorRecord.mennyuOrdersPaused ?? false,
        name: vendorRecord.name,
        slug: vendorRecord.slug,
        description: vendorRecord.description,
        imageUrl: vendorRecord.imageUrl,
        cuisineCategory: vendorRecord.cuisineCategory,
        contactEmail: vendorRecord.contactEmail,
        contactPhone: vendorRecord.contactPhone,
      },
      menuSummary,
      posSummary: {
        deliverectChannelLinkId: vendorRecord.deliverectChannelLinkId,
        posConnectionStatus: vendorRecord.posConnectionStatus,
        deliverectAutoMapLastOutcome: vendorRecord.deliverectAutoMapLastOutcome,
        pendingDeliverectConnectionKey: vendorRecord.pendingDeliverectConnectionKey,
        hasUnmatchedChannelRegistration,
      },
      stripeSummary: {
        stripeConnectedAccountId: vendorRecord.stripeConnectedAccountId,
        stripeChargesEnabled: vendorRecord.stripeChargesEnabled ?? false,
        stripePayoutsEnabled: vendorRecord.stripePayoutsEnabled ?? false,
        stripeConnectConfigured: Boolean(env.STRIPE_SECRET_KEY),
      },
      pendingPodInviteCount: pendingInvites,
      hasPodMembership: Boolean(currentPod),
    },
    { audience: "vendor" }
  );

  const setupComplete = isVendorSetupComplete(
    readiness.checklist.filter((item) => item.complete).map((item) => item.key)
  );

  const hoursTimezone = resolveVendorHoursTimezone(currentPod?.pod.pickupTimezone);
  const hoursSummary = summarizeVendorCustomerOrderingHours({
    vendor: {
      syncCustomerOrderingHoursFromDeliverect:
        vendorRecord.syncCustomerOrderingHoursFromDeliverect ?? false,
      customerOrderingHours: vendorRecord.customerOrderingHours,
      deliverectSyncedCustomerOrderingHours: vendorRecord.deliverectSyncedCustomerOrderingHours,
    },
    posConnected,
    timeZone: hoursTimezone,
  });

  const availability = getVendorAvailability({
    isActive: vendorRecord.isActive,
    mennyuOrdersPaused: vendorRecord.mennyuOrdersPaused ?? false,
    posOpen: hoursSummary.posOpen,
  });

  const intakeLabel = vendorIntakeStatusLabel({
    availabilityStatus: availability.status,
    setupComplete,
    canAcceptOrders: readiness.canAcceptOrders,
  });

  const initialNowMs = Date.now();
  const initialVendorOrdersForClient = serializeVendorOrdersForBoard(
    boardData.vendorOrders,
    boardData.vendor,
    initialNowMs
  );
  const grouped = groupVendorOrdersForBoard(initialVendorOrdersForClient);
  const activeCounts = countActiveBoardGroups(grouped);

  const attentionItems = deriveVendorAttentionItems({
    blockingReasons: readiness.blockingReasons,
    posState,
    paymentsReady,
    menuSynced: menuReady,
    hasPodMembership: Boolean(currentPod),
    pendingPodInviteCount: pendingInvites,
    failedOrdersToday: todayStats.failedOrCancelled,
    intakeLabel,
  }).map((item) => {
    if (item.id === "stripe" && !item.actionHref) {
      return { ...item, actionHref: `/vendor/${vendorId}/payouts`, actionLabel: "Finish setup" };
    }
    if (item.id === "pos_disconnected" || item.id === "pos_attention") {
      return { ...item, actionHref: `/vendor/${vendorId}/setup`, actionLabel: "Open setup" };
    }
    if (item.id === "menu_sync") {
      return { ...item, actionHref: `/vendor/${vendorId}/menu`, actionLabel: "Review menu" };
    }
    if (item.id === "pod_invite") {
      return {
        ...item,
        actionHref: `/vendor/${vendorId}/settings?section=pod-membership`,
        actionLabel: "View invitations",
      };
    }
    if (item.id === "no_pod") {
      return {
        ...item,
        actionHref: `/vendor/${vendorId}/settings?section=pod-membership`,
        actionLabel: "Pod membership",
      };
    }
    if (item.id === "failed_orders") {
      return { ...item, actionHref: `/vendor/${vendorId}/orders`, actionLabel: "View orders" };
    }
    return item;
  });

  const storefrontHref =
    currentPod?.pod.slug && vendorRecord.slug
      ? buildVendorMenuCustomerPath(currentPod.pod.slug, vendorRecord.slug)
      : null;

  return {
    vendor: boardData.vendor,
    vendorRecord,
    readiness,
    setupComplete,
    posState,
    posConnected,
    paymentsReady,
    menuReady,
    menuSummary,
    intakeLabel,
    posConnectionLabel: vendorPosConnectionLabel(posState),
    menuSyncLabel: vendorMenuSyncLabel({
      posConnected,
      menuReady,
      hasOperationalItems: menuSummary.hasOperationalItems,
    }),
    paymentsLabel: vendorPaymentsReadinessLabel(paymentsReady),
    posManaged: posConnected,
    currentPod: currentPod
      ? { id: currentPod.pod.id, name: currentPod.pod.name, slug: currentPod.pod.slug }
      : null,
    storefrontHref,
    attentionItems,
    activeCounts,
    todayStats,
    initialVendorOrdersForClient,
    initialNowMs,
    isDeliverectLive: isRoutingRetryAvailable(),
    lastMenuSyncAt: vendorRecord.deliverectAutoMapLastAt?.toISOString() ?? null,
    hoursSummary,
  };
});

async function loadVendorTodayPerformance(vendorId: string) {
  const todayStart = startOfToday();
  const [completedAgg, tipsAgg, failedOrCancelled] = await Promise.all([
    prisma.vendorOrder.aggregate({
      where: {
        vendorId,
        fulfillmentStatus: "completed",
        createdAt: { gte: todayStart },
      },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.vendorOrder.aggregate({
      where: {
        vendorId,
        fulfillmentStatus: "completed",
        createdAt: { gte: todayStart },
      },
      _sum: { tipCents: true },
    }),
    prisma.vendorOrder.count({
      where: {
        vendorId,
        createdAt: { gte: todayStart },
        OR: [{ fulfillmentStatus: "cancelled" }, { routingStatus: "failed" }],
      },
    }),
  ]);

  const orders = completedAgg._count;
  const salesCents = completedAgg._sum.totalCents ?? 0;
  const tipsCents = tipsAgg._sum.tipCents ?? 0;

  return {
    orders,
    salesCents,
    tipsCents,
    avgOrderCents: orders > 0 ? Math.round(salesCents / orders) : 0,
    failedOrCancelled,
  };
}
