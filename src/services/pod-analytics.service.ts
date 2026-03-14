/**
 * Pod Analytics v1: pod-level aggregates only. No vendor-specific metrics.
 * Privacy: no per-vendor revenue, order counts, or sensitive details.
 */

import { prisma } from "@/lib/db";
import { getExceptionType } from "@/lib/admin-exceptions";
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfLast7Days(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 7);
  return d;
}

/** Day label and aggregates for trends. */
export interface PodTrendDay {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Mon 3/10"
  orderCount: number;
  revenueCents: number;
}

export interface PodAnalytics {
  podName: string;
  summary: {
    activeVendors: number;
    ordersToday: number;
    ordersLast7: number;
    grossSalesTodayCents: number;
    grossSalesLast7Cents: number;
    avgOrderValueCents: number;
  };
  trends: PodTrendDay[];
  participation: {
    vendorsInPod: number;
    vendorsWithOrderToday: number;
    vendorsWithOrderLast7: number;
    vendorsPausedMennyu: number;
    vendorsActiveMennyu: number;
  };
  health: {
    needsAttentionCount: number;
    routingIssuesToday: number;
    manualRecoveriesToday: number;
    cancelledToday: number;
  };
}

/**
 * Returns pod-level analytics. All metrics are aggregated; no vendor-level breakdown.
 */
export async function getPodAnalytics(podId: string): Promise<PodAnalytics | null> {
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true },
  });
  if (!pod) return null;

  const todayStart = startOfToday();
  const sevenDaysStart = startOfLast7Days();

  const podVendors = await prisma.podVendor.findMany({
    where: { podId, isActive: true },
    select: { vendorId: true },
  });
  const vendorIds = podVendors.map((pv) => pv.vendorId);

  const [
    ordersToday,
    ordersLast7,
    salesToday,
    salesLast7,
    vendorOrdersForHealth,
    vendorOrdersTodayForParticipation,
    vendorOrdersLast7ForParticipation,
    manualRecoveryHistoryToday,
    cancelledToday,
    vendorsInPodWithPause,
  ] = await Promise.all([
    prisma.order.count({
      where: { podId, createdAt: { gte: todayStart } },
    }),
    prisma.order.count({
      where: { podId, createdAt: { gte: sevenDaysStart } },
    }),
    prisma.vendorOrder.aggregate({
      where: {
        order: { podId },
        fulfillmentStatus: "completed",
        createdAt: { gte: todayStart },
      },
      _sum: { totalCents: true },
    }),
    prisma.vendorOrder.aggregate({
      where: {
        order: { podId },
        fulfillmentStatus: "completed",
        createdAt: { gte: sevenDaysStart },
      },
      _sum: { totalCents: true },
    }),
    prisma.vendorOrder.findMany({
      where: { order: { podId }, createdAt: { gte: sevenDaysStart } },
      select: {
        id: true,
        routingStatus: true,
        fulfillmentStatus: true,
        createdAt: true,
        deliverectAttempts: true,
        deliverectSubmittedAt: true,
        deliverectLastError: true,
      },
    }),
    prisma.vendorOrder.findMany({
      where: {
        order: { podId },
        fulfillmentStatus: "completed",
        createdAt: { gte: todayStart },
      },
      select: { vendorId: true },
    }),
    prisma.vendorOrder.findMany({
      where: {
        order: { podId },
        fulfillmentStatus: "completed",
        createdAt: { gte: sevenDaysStart },
      },
      select: { vendorId: true },
    }),
    prisma.vendorOrderStatusHistory.findMany({
      where: {
        source: "admin_manual_recovery",
        createdAt: { gte: todayStart },
        vendorOrder: { order: { podId } },
      },
      select: { vendorOrderId: true },
    }),
    prisma.vendorOrder.count({
      where: {
        order: { podId },
        fulfillmentStatus: "cancelled",
        createdAt: { gte: todayStart },
      },
    }),
    vendorIds.length === 0
      ? Promise.resolve([])
      : prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, mennyuOrdersPaused: true },
        }),
  ]);

  const vendorIdsInPod = new Set(podVendors.map((pv) => pv.vendorId));
  const vendorsWithOrderToday = new Set(vendorOrdersTodayForParticipation.map((v) => v.vendorId)).size;
  const vendorsWithOrderLast7 = new Set(vendorOrdersLast7ForParticipation.map((v) => v.vendorId)).size;
  const vendorsPausedMennyu = vendorsInPodWithPause.filter((v) => v.mennyuOrdersPaused).length;
  const vendorsActiveMennyu = vendorsInPodWithPause.filter((v) => !v.mennyuOrdersPaused).length;

  const ROUTING_STUCK_MS = 30 * 60 * 1000;
  const isRoutingStuck = (vo: { createdAt: Date }) =>
    Date.now() - vo.createdAt.getTime() > ROUTING_STUCK_MS;

  const needsAttentionList = vendorOrdersForHealth.filter((vo) => {
    if (vo.fulfillmentStatus !== "pending") return false;
    const type = getExceptionType({
      id: vo.id,
      orderId: "",
      routingStatus: vo.routingStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      createdAt: vo.createdAt,
      deliverectAttempts: vo.deliverectAttempts,
      deliverectSubmittedAt: vo.deliverectSubmittedAt,
      deliverectLastError: vo.deliverectLastError,
    });
    return type !== null;
  });
  const routingIssuesToday = vendorOrdersForHealth.filter(
    (vo) =>
      vo.createdAt >= todayStart &&
      (vo.routingStatus === "failed" || (vo.routingStatus === "pending" && isRoutingStuck(vo)))
  ).length;
  const manualRecoveriesToday = new Set(manualRecoveryHistoryToday.map((h) => h.vendorOrderId)).size;

  const grossSalesTodayCents = salesToday._sum.totalCents ?? 0;
  const grossSalesLast7Cents = salesLast7._sum.totalCents ?? 0;
  const avgOrderValueCents =
    ordersLast7 > 0 ? Math.round(grossSalesLast7Cents / ordersLast7) : 0;

  const [ordersInRange, vendorOrdersInRange] = await Promise.all([
    prisma.order.findMany({
      where: { podId, createdAt: { gte: sevenDaysStart } },
      select: { createdAt: true },
    }),
    prisma.vendorOrder.findMany({
      where: {
        order: { podId },
        fulfillmentStatus: "completed",
        createdAt: { gte: sevenDaysStart },
      },
      select: { totalCents: true, createdAt: true },
    }),
  ]);

  const trendDays: PodTrendDay[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayStart);
    d.setDate(d.getDate() - i);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const orderCount = ordersInRange.filter(
      (o) => o.createdAt >= dayStart && o.createdAt < dayEnd
    ).length;
    const revenueCents = vendorOrdersInRange
      .filter((vo) => vo.createdAt >= dayStart && vo.createdAt < dayEnd)
      .reduce((sum, vo) => sum + vo.totalCents, 0);

    trendDays.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString(undefined, {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      orderCount,
      revenueCents,
    });
  }

  return {
    podName: pod.name,
    summary: {
      activeVendors: vendorIdsInPod.size,
      ordersToday,
      ordersLast7,
      grossSalesTodayCents,
      grossSalesLast7Cents,
      avgOrderValueCents,
    },
    trends: trendDays,
    participation: {
      vendorsInPod: vendorIdsInPod.size,
      vendorsWithOrderToday,
      vendorsWithOrderLast7,
      vendorsPausedMennyu,
      vendorsActiveMennyu,
    },
    health: {
      needsAttentionCount: needsAttentionList.length,
      routingIssuesToday,
      manualRecoveriesToday,
      cancelledToday,
    },
  };
}
