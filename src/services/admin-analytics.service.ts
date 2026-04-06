/**
 * Admin Analytics: platform-wide aggregates for /admin/analytics.
 * Reuses existing schema and exception/health semantics. No BI; Prisma-only.
 */

import { prisma } from "@/lib/db";
import { ROUTING_STUCK_THRESHOLD_MINUTES } from "@/lib/admin-exceptions";

export type AdminAnalyticsRange = "today" | "7d" | "30d";

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function rangeToDates(range: AdminAnalyticsRange): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(startOfToday());
  if (range === "today") {
    return { start: startOfToday(), end };
  }
  if (range === "7d") {
    start.setDate(start.getDate() - 7);
    return { start, end };
  }
  // 30d
  start.setDate(start.getDate() - 30);
  return { start, end };
}

export interface AdminAnalyticsSummary {
  totalOrders: number;
  grossSalesCents: number;
  activeVendors: number;
  activePods: number;
  averageOrderValueCents: number;
  ordersNeedingAttention: number;
  /** Mennyu revenue from customer service fee only (no tips/tax; excludes vendor processing recovery). */
  mennyuRevenueCents: number;
  serviceFeeRevenueCents: number;
  /** Sum of vendor-side processing recovery on food subtotals (tips excluded from recovery base). */
  vendorProcessingRecoveryTotalCents: number;
  revenuePerOrderCents: number;
}

export interface AdminAnalyticsTrendDay {
  date: string;
  label: string;
  orderCount: number;
  grossSalesCents: number;
}

export interface AdminAnalyticsTopVendor {
  vendorId: string;
  vendorName: string;
  orderCount: number;
  revenueCents: number;
}

export interface AdminAnalyticsTopPod {
  podId: string;
  podName: string;
  orderCount: number;
}

export interface AdminAnalyticsTopItem {
  name: string;
  quantity: number;
}

export interface AdminAnalyticsHealth {
  routingFailures: number;
  manualRecoveries: number;
  cancelledVendorOrders: number;
  openOrderIssues: number;
  openVendorOrderIssues: number;
  completionRatePercent: number;
}

export interface AdminAnalytics {
  range: AdminAnalyticsRange;
  summary: AdminAnalyticsSummary;
  trends: AdminAnalyticsTrendDay[];
  topVendors: AdminAnalyticsTopVendor[];
  topPods: AdminAnalyticsTopPod[];
  topItems: AdminAnalyticsTopItem[];
  health: AdminAnalyticsHealth;
}

/**
 * Returns all analytics data for the admin analytics page.
 */
export async function getAdminAnalytics(range: AdminAnalyticsRange): Promise<AdminAnalytics> {
  const { start, end } = rangeToDates(range);
  const routingStuckBefore = new Date(
    Date.now() - ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000
  );

  const [
    totalOrders,
    grossSalesAgg,
    serviceFeeAgg,
    processingRecoveryAgg,
    activeVendorsAgg,
    activePodsAgg,
    needsAttentionFailed,
    needsAttentionStuck,
    ordersInRangeForTrends,
    topVendorsRaw,
    topPodsRaw,
    topItemsRaw,
    routingFailuresInRange,
    manualRecoveriesInRange,
    cancelledInRange,
    openOrderIssues,
    openVendorOrderIssues,
    completedOrdersInRange,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: start, lte: end } },
      _sum: { totalCents: true },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: start, lte: end } },
      _sum: { serviceFeeCents: true },
    }),
    prisma.vendorOrder.aggregate({
      where: { createdAt: { gte: start, lte: end } },
      _sum: { vendorProcessingFeeRecoveryCents: true },
    }),
    prisma.vendorOrder.groupBy({
      by: ["vendorId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    }),
    prisma.order.groupBy({
      by: ["podId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: "failed",
        fulfillmentStatus: "pending",
      },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: "pending",
        fulfillmentStatus: "pending",
        createdAt: { lt: routingStuckBefore },
      },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalCents: true, status: true },
    }),
    prisma.vendorOrder.groupBy({
      by: ["vendorId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.order.groupBy({
      by: ["podId"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    }),
    prisma.orderLineItem.findMany({
      where: {
        vendorOrder: { createdAt: { gte: start, lte: end } },
      },
      select: { name: true, quantity: true },
    }),
    prisma.vendorOrder.count({
      where: {
        createdAt: { gte: start, lte: end },
        routingStatus: "failed",
      },
    }),
    prisma.vendorOrder.count({
      where: {
        manuallyRecoveredAt: { gte: start, lte: end },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        fulfillmentStatus: "cancelled",
        updatedAt: { gte: start, lte: end },
      },
    }),
    prisma.orderIssue.count({ where: { status: "OPEN" } }),
    prisma.vendorOrderIssue.count({ where: { status: "OPEN" } }),
    prisma.order.count({
      where: {
        createdAt: { gte: start, lte: end },
        status: "completed",
      },
    }),
  ]);

  const grossSalesCents = grossSalesAgg._sum.totalCents ?? 0;
  const serviceFeeRevenueCents = serviceFeeAgg._sum.serviceFeeCents ?? 0;
  const vendorProcessingRecoveryTotalCents =
    processingRecoveryAgg._sum.vendorProcessingFeeRecoveryCents ?? 0;
  const mennyuRevenueCents = serviceFeeRevenueCents;
  const ordersNeedingAttention = needsAttentionFailed + needsAttentionStuck;
  const averageOrderValueCents =
    totalOrders > 0 ? Math.round(grossSalesCents / totalOrders) : 0;
  const revenuePerOrderCents =
    totalOrders > 0 ? Math.round(mennyuRevenueCents / totalOrders) : 0;

  const summary: AdminAnalyticsSummary = {
    totalOrders,
    grossSalesCents,
    activeVendors: activeVendorsAgg.length,
    activePods: activePodsAgg.length,
    averageOrderValueCents,
    ordersNeedingAttention,
    mennyuRevenueCents,
    serviceFeeRevenueCents,
    vendorProcessingRecoveryTotalCents,
    revenuePerOrderCents,
  };

  const dayMap = new Map<string, { orderCount: number; grossSalesCents: number }>();
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(end);
  dayEnd.setHours(23, 59, 59, 999);
  for (const o of ordersInRangeForTrends) {
    const d = new Date(o.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const cur = dayMap.get(key) ?? { orderCount: 0, grossSalesCents: 0 };
    cur.orderCount += 1;
    cur.grossSalesCents += o.totalCents;
    dayMap.set(key, cur);
  }
  const sortedDays = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const trends: AdminAnalyticsTrendDay[] = sortedDays.map(([date, data]) => ({
    date,
    label: new Date(date + "Z").toLocaleDateString(undefined, {
      weekday: "short",
      month: "numeric",
      day: "numeric",
    }),
    orderCount: data.orderCount,
    grossSalesCents: data.grossSalesCents,
  }));

  const vendorIds = topVendorsRaw.map((r) => r.vendorId);
  const vendors =
    vendorIds.length === 0
      ? []
      : await prisma.vendor.findMany({
          where: { id: { in: vendorIds } },
          select: { id: true, name: true },
        });
  const vendorNameMap = new Map(vendors.map((v) => [v.id, v.name]));
  const topVendors: AdminAnalyticsTopVendor[] = topVendorsRaw
    .map((r) => ({
      vendorId: r.vendorId,
      vendorName: vendorNameMap.get(r.vendorId) ?? "Unknown",
      orderCount: r._count,
      revenueCents: r._sum.totalCents ?? 0,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10);

  const podIds = topPodsRaw.map((r) => r.podId);
  const pods =
    podIds.length === 0
      ? []
      : await prisma.pod.findMany({
          where: { id: { in: podIds } },
          select: { id: true, name: true },
        });
  const podNameMap = new Map(pods.map((p) => [p.id, p.name]));
  const topPods: AdminAnalyticsTopPod[] = topPodsRaw
    .map((r) => ({
      podId: r.podId,
      podName: podNameMap.get(r.podId) ?? "Unknown",
      orderCount: r._count,
    }))
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 10);

  const itemQuantities = new Map<string, number>();
  for (const line of topItemsRaw) {
    const q = itemQuantities.get(line.name) ?? 0;
    itemQuantities.set(line.name, q + line.quantity);
  }
  const topItems: AdminAnalyticsTopItem[] = Array.from(itemQuantities.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const completionRatePercent =
    totalOrders > 0 ? Math.round((completedOrdersInRange / totalOrders) * 100) : 0;

  const health: AdminAnalyticsHealth = {
    routingFailures: routingFailuresInRange,
    manualRecoveries: manualRecoveriesInRange,
    cancelledVendorOrders: cancelledInRange,
    openOrderIssues: openOrderIssues,
    openVendorOrderIssues: openVendorOrderIssues,
    completionRatePercent,
  };

  return {
    range,
    summary,
    trends,
    topVendors,
    topPods,
    topItems,
    health,
  };
}
