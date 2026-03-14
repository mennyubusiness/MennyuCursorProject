/**
 * Vendor Analytics v1: simple aggregates for vendor dashboard.
 * Metrics use completed VendorOrders only. No schema changes.
 */

import { prisma } from "@/lib/db";

/** Start of today in server local time (for "today" bucket). */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Start of the day 7 days ago in server local time (for "last 7 days" bucket). */
function startOfLast7Days(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - 7);
  return d;
}

export interface VendorAnalyticsPeriod {
  orders: number;
  revenueCents: number;
  /** Average order value in cents; 0 if no orders. */
  avgOrderCents: number;
}

export interface VendorTopItem {
  name: string;
  quantity: number;
}

export interface VendorAnalytics {
  today: VendorAnalyticsPeriod;
  last7: VendorAnalyticsPeriod;
  topItems: VendorTopItem[];
}

/**
 * Returns analytics for the vendor: today, last 7 days, and top items (last 7 days).
 * Only completed vendor orders are counted for business metrics.
 */
export async function getVendorAnalytics(vendorId: string): Promise<VendorAnalytics> {
  const todayStart = startOfToday();
  const sevenDaysStart = startOfLast7Days();

  const [todayAgg, last7Agg, lineItems] = await Promise.all([
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
        createdAt: { gte: sevenDaysStart },
      },
      _count: true,
      _sum: { totalCents: true },
    }),
    prisma.orderLineItem.findMany({
      where: {
        vendorOrder: {
          vendorId,
          fulfillmentStatus: "completed",
          createdAt: { gte: sevenDaysStart },
        },
      },
      select: { name: true, quantity: true },
    }),
  ]);

  const todayRevenue = todayAgg._sum.totalCents ?? 0;
  const todayOrders = todayAgg._count;
  const last7Revenue = last7Agg._sum.totalCents ?? 0;
  const last7Orders = last7Agg._count;

  const byName = new Map<string, number>();
  for (const line of lineItems) {
    const q = byName.get(line.name) ?? 0;
    byName.set(line.name, q + line.quantity);
  }
  const topItems: VendorTopItem[] = Array.from(byName.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  return {
    today: {
      orders: todayOrders,
      revenueCents: todayRevenue,
      avgOrderCents: todayOrders > 0 ? Math.round(todayRevenue / todayOrders) : 0,
    },
    last7: {
      orders: last7Orders,
      revenueCents: last7Revenue,
      avgOrderCents: last7Orders > 0 ? Math.round(last7Revenue / last7Orders) : 0,
    },
    topItems,
  };
}
