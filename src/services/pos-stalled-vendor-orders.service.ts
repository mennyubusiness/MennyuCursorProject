/**
 * Heuristic: POS-linked vendor orders that may be stuck (no progress / no webhook activity).
 * For admin triage — use with manual recovery / admin_override when kitchen confirms.
 */
import type { VendorFulfillmentStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getEffectiveAuthority } from "@/domain/status-authority";

const DEFAULT_STUCK_FULFILLMENT: VendorFulfillmentStatus[] = [
  "pending",
  "accepted",
  "preparing",
];

export interface StalledPosManagedVendorOrder {
  vendorOrderId: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  statusAuthority: string | null;
  minutesSinceActivity: number;
  lastExternalStatus: string | null;
  lastExternalStatusAt: string | null;
  /** Human-readable explanation for admins */
  reason: string;
}

export async function findStalledPosManagedVendorOrders(opts: {
  /** No webhook-driven VO update (updatedAt) older than this many minutes */
  minIdleMinutes: number;
  stuckFulfillment?: VendorFulfillmentStatus[];
  now?: Date;
}): Promise<StalledPosManagedVendorOrder[]> {
  const now = opts.now ?? new Date();
  const cutoff = new Date(now.getTime() - opts.minIdleMinutes * 60_000);
  const stuck = opts.stuckFulfillment ?? DEFAULT_STUCK_FULFILLMENT;

  const rows = await prisma.vendorOrder.findMany({
    where: {
      routingStatus: { in: ["sent", "confirmed"] },
      fulfillmentStatus: { in: stuck },
      updatedAt: { lt: cutoff },
      OR: [
        { deliverectChannelLinkId: { not: null } },
        { vendor: { is: { deliverectChannelLinkId: { not: null } } } },
      ],
    },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      updatedAt: true,
      lastExternalStatus: true,
      lastExternalStatusAt: true,
      statusAuthority: true,
      lastStatusSource: true,
      deliverectChannelLinkId: true,
      manuallyRecoveredAt: true,
      vendor: { select: { deliverectChannelLinkId: true } },
    },
  });

  const out: StalledPosManagedVendorOrder[] = [];

  for (const vo of rows) {
    const authority = getEffectiveAuthority({
      statusAuthority: vo.statusAuthority,
      lastStatusSource: vo.lastStatusSource,
      deliverectChannelLinkId: vo.deliverectChannelLinkId,
      routingStatus: vo.routingStatus,
      manuallyRecoveredAt: vo.manuallyRecoveredAt,
      vendor: vo.vendor,
    });

    if (authority !== "pos") continue;

    const activityAt = vo.lastExternalStatusAt ?? vo.updatedAt;
    const idleMs = now.getTime() - activityAt.getTime();
    const minutesSinceActivity = Math.floor(idleMs / 60_000);

    out.push({
      vendorOrderId: vo.id,
      orderId: vo.orderId,
      routingStatus: vo.routingStatus,
      fulfillmentStatus: vo.fulfillmentStatus,
      statusAuthority: vo.statusAuthority,
      minutesSinceActivity,
      lastExternalStatus: vo.lastExternalStatus,
      lastExternalStatusAt: vo.lastExternalStatusAt?.toISOString() ?? null,
      reason: `POS-managed order (effective authority: pos) still in fulfillment "${vo.fulfillmentStatus}" with routing "${vo.routingStatus}" after ~${minutesSinceActivity} minutes since last activity (${activityAt.toISOString()}). Deliverect webhooks may be missing or mapping may be failing — use admin manual recovery / admin_override if the kitchen confirms the order advanced.`,
    });
  }

  return out;
}
