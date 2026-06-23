/**
 * Pod-level activity feed for pod owner dashboard.
 * Privacy: no customer PII, no per-vendor revenue, no payment internals.
 */

import { prisma } from "@/lib/db";
import { podOwnerVendorDisplayStatus } from "@/lib/pod-vendor-adoption";
import type { VendorPodReadinessStatus } from "@/lib/vendor-pod-readiness";

const ACTIVITY_LOOKBACK_DAYS = 14;
const MAX_RECENT_ITEMS = 6;
const MAX_CURRENT_STATUS_ITEMS = 3;
const MAX_TOTAL_ITEMS = 8;

const ACTIVE_ORDER_STATUSES = [
  "paid",
  "routing",
  "routed_partial",
  "routed",
  "accepted",
  "preparing",
  "ready",
  "completed",
] as const;

export type PodActivityKind =
  | "membership_invited"
  | "membership_accepted"
  | "vendor_joined"
  | "order_placed"
  | "group_order_placed"
  | "orders_today_summary"
  | "vendor_live"
  | "vendor_needs_setup"
  | "vendor_paused";

export type PodActivitySection = "recent" | "current_status";

export type PodActivityItem = {
  id: string;
  kind: PodActivityKind;
  message: string;
  occurredAt: Date | null;
  section: PodActivitySection;
};

export type PodActivityFeed = {
  recent: PodActivityItem[];
  currentStatus: PodActivityItem[];
  isEmpty: boolean;
};

export type PodActivityRosterSnapshot = {
  vendorId: string;
  name: string;
  podVendorActive: boolean;
  vendorGloballyActive: boolean;
  readiness: {
    status: VendorPodReadinessStatus;
    canAcceptOrders: boolean;
  };
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function lookbackStart(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - ACTIVITY_LOOKBACK_DAYS);
  return d;
}

export function formatPodActivityTimestamp(date: Date): string {
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function vendorNeedsSetupActivityMessage(vendorName: string, displayStatus: string): string {
  switch (displayStatus) {
    case "Needs Stripe":
      return `${vendorName} still needs Stripe setup before customers can order.`;
    case "Needs menu":
      return `${vendorName} still needs menu setup before customers can order.`;
    case "Needs POS connection":
      return `${vendorName} still needs POS connection setup before customers can order.`;
    case "Needs profile":
      return `${vendorName} still needs profile setup before customers can order.`;
    default:
      return `${vendorName} still needs setup before customers can order.`;
  }
}

export function buildVendorLiveActivityMessage(vendorName: string): string {
  return `${vendorName} is now live on your pod page.`;
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildCurrentStatusActivityItems(
  roster: PodActivityRosterSnapshot[]
): PodActivityItem[] {
  const needsSetup: PodActivityItem[] = [];
  const paused: PodActivityItem[] = [];
  const live: PodActivityItem[] = [];

  for (const row of roster) {
    if (!row.vendorGloballyActive) continue;

    const displayStatus = podOwnerVendorDisplayStatus(
      row.readiness.status,
      row.readiness.canAcceptOrders
    );

    if (row.readiness.canAcceptOrders) {
      live.push({
        id: `status-live-${row.vendorId}`,
        kind: "vendor_live",
        message: buildVendorLiveActivityMessage(row.name),
        occurredAt: null,
        section: "current_status",
      });
      continue;
    }

    if (displayStatus === "Paused in pod") {
      paused.push({
        id: `status-paused-${row.vendorId}`,
        kind: "vendor_paused",
        message: `${row.name} is paused in your pod.`,
        occurredAt: null,
        section: "current_status",
      });
      continue;
    }

    if (displayStatus.startsWith("Needs ")) {
      needsSetup.push({
        id: `status-needs-${row.vendorId}`,
        kind: "vendor_needs_setup",
        message: vendorNeedsSetupActivityMessage(row.name, displayStatus),
        occurredAt: null,
        section: "current_status",
      });
    }
  }

  return [...needsSetup, ...paused, ...live].slice(0, MAX_CURRENT_STATUS_ITEMS);
}

type TimestampedActivityInput = {
  membershipInvites: Array<{ id: string; vendorName: string; createdAt: Date }>;
  membershipAccepted: Array<{ id: string; vendorId: string; vendorName: string; respondedAt: Date }>;
  vendorJoins: Array<{ vendorId: string; vendorName: string; createdAt: Date }>;
  recentOrders: Array<{ id: string; createdAt: Date; groupOrderSessionId: string | null }>;
  ordersToday: number;
  latestOrderTodayAt: Date | null;
};

export function buildTimestampedPodActivityItems(input: TimestampedActivityInput): PodActivityItem[] {
  const items: PodActivityItem[] = [];
  const todayStart = startOfToday();
  const acceptedVendorIds = new Set(input.membershipAccepted.map((row) => row.vendorId));

  for (const invite of input.membershipInvites) {
    items.push({
      id: `invite-${invite.id}`,
      kind: "membership_invited",
      message: `You invited ${invite.vendorName} to join your pod.`,
      occurredAt: invite.createdAt,
      section: "recent",
    });
  }

  for (const accepted of input.membershipAccepted) {
    items.push({
      id: `accepted-${accepted.id}`,
      kind: "membership_accepted",
      message: `${accepted.vendorName} joined your pod.`,
      occurredAt: accepted.respondedAt,
      section: "recent",
    });
  }

  for (const join of input.vendorJoins) {
    if (acceptedVendorIds.has(join.vendorId)) continue;
    items.push({
      id: `join-${join.vendorId}-${join.createdAt.toISOString()}`,
      kind: "vendor_joined",
      message: `${join.vendorName} was added to your pod.`,
      occurredAt: join.createdAt,
      section: "recent",
    });
  }

  if (input.ordersToday >= 2) {
    items.push({
      id: "orders-today-summary",
      kind: "orders_today_summary",
      message: `${input.ordersToday} Open Order orders were placed at your pod today.`,
      occurredAt: input.latestOrderTodayAt ?? todayStart,
      section: "recent",
    });
  } else if (input.ordersToday === 1 && input.latestOrderTodayAt) {
    const latestTodayOrder = input.recentOrders.find((order) =>
      isSameCalendarDay(order.createdAt, todayStart)
    );
    items.push({
      id: latestTodayOrder ? `order-${latestTodayOrder.id}` : "order-today-single",
      kind: latestTodayOrder?.groupOrderSessionId ? "group_order_placed" : "order_placed",
      message: latestTodayOrder?.groupOrderSessionId
        ? "A group order was placed at your pod."
        : "An Open Order was placed at your pod.",
      occurredAt: input.latestOrderTodayAt,
      section: "recent",
    });
  }

  const seenGroupSessions = new Set<string>();
  for (const order of input.recentOrders) {
    if (isSameCalendarDay(order.createdAt, todayStart) && input.ordersToday >= 2) {
      continue;
    }
    if (input.ordersToday === 1 && isSameCalendarDay(order.createdAt, todayStart)) {
      continue;
    }

    if (order.groupOrderSessionId) {
      if (seenGroupSessions.has(order.groupOrderSessionId)) continue;
      seenGroupSessions.add(order.groupOrderSessionId);
      items.push({
        id: `group-order-${order.groupOrderSessionId}`,
        kind: "group_order_placed",
        message: "A group order was placed at your pod.",
        occurredAt: order.createdAt,
        section: "recent",
      });
      continue;
    }

    items.push({
      id: `order-${order.id}`,
      kind: "order_placed",
      message: "An Open Order was placed at your pod.",
      occurredAt: order.createdAt,
      section: "recent",
    });
  }

  return items
    .filter((item) => item.occurredAt != null)
    .sort((a, b) => b.occurredAt!.getTime() - a.occurredAt!.getTime())
    .slice(0, MAX_RECENT_ITEMS);
}

export function assemblePodActivityFeed(
  recentCandidates: PodActivityItem[],
  currentStatusCandidates: PodActivityItem[]
): PodActivityFeed {
  const recent = recentCandidates.slice(0, MAX_RECENT_ITEMS);
  const remaining = Math.max(0, MAX_TOTAL_ITEMS - recent.length);
  const currentStatus = currentStatusCandidates.slice(0, Math.min(MAX_CURRENT_STATUS_ITEMS, remaining));

  return {
    recent,
    currentStatus,
    isEmpty: recent.length === 0 && currentStatus.length === 0,
  };
}

/** Returns true when activity messages appear free of common PII/financial leakage patterns. */
export function isPodActivityMessageSafe(message: string): boolean {
  if (/\$\d/.test(message)) return false;
  if (/@/.test(message)) return false;
  if (/\(\d{3}\)\s*\d{3}-\d{4}/.test(message)) return false;
  if (/revenue|payout|payment intent|stripe_pi_/i.test(message)) return false;
  return true;
}

export async function getPodActivityFeed(
  podId: string,
  opts: {
    roster: PodActivityRosterSnapshot[];
    ordersToday: number;
  }
): Promise<PodActivityFeed> {
  const since = lookbackStart();
  const todayStart = startOfToday();

  const [
    membershipInvites,
    membershipAccepted,
    vendorJoins,
    recentOrders,
    latestOrderToday,
  ] = await Promise.all([
    prisma.podMembershipRequest.findMany({
      where: { podId, status: "pending", createdAt: { gte: since } },
      select: {
        id: true,
        createdAt: true,
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.podMembershipRequest.findMany({
      where: {
        podId,
        status: "accepted",
        respondedAt: { not: null, gte: since },
      },
      select: {
        id: true,
        vendorId: true,
        respondedAt: true,
        vendor: { select: { name: true } },
      },
      orderBy: { respondedAt: "desc" },
      take: 10,
    }),
    prisma.podVendor.findMany({
      where: { podId, createdAt: { gte: since } },
      select: {
        vendorId: true,
        createdAt: true,
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        podId,
        createdAt: { gte: since },
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      select: {
        id: true,
        createdAt: true,
        groupOrderSessionId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.order.findFirst({
      where: {
        podId,
        createdAt: { gte: todayStart },
        status: { in: [...ACTIVE_ORDER_STATUSES] },
      },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const recent = buildTimestampedPodActivityItems({
    membershipInvites: membershipInvites.map((row) => ({
      id: row.id,
      vendorName: row.vendor.name,
      createdAt: row.createdAt,
    })),
    membershipAccepted: membershipAccepted
      .filter((row) => row.respondedAt != null)
      .map((row) => ({
        id: row.id,
        vendorId: row.vendorId,
        vendorName: row.vendor.name,
        respondedAt: row.respondedAt!,
      })),
    vendorJoins: vendorJoins.map((row) => ({
      vendorId: row.vendorId,
      vendorName: row.vendor.name,
      createdAt: row.createdAt,
    })),
    recentOrders,
    ordersToday: opts.ordersToday,
    latestOrderTodayAt: latestOrderToday?.createdAt ?? null,
  });

  const currentStatus = buildCurrentStatusActivityItems(opts.roster);

  return assemblePodActivityFeed(recent, currentStatus);
}
