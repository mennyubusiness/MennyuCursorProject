/**
 * Shared vendor-order status writes: routing/fulfillment, lastStatusSource, optional external status,
 * and VendorOrderStatusHistory with authority + statusSource + externalStatus.
 * Precedence (vendor dashboard) is enforced in applyVendorOrderTransition, not here.
 */
import type {
  Prisma,
  VendorOrderStatusAuthority,
  VendorOrderStatusSource,
} from "@prisma/client";
import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ParentOrderStatus } from "@/domain/types";
import {
  getEffectiveAuthority,
  type VendorOrderAuthoritySnapshot,
} from "@/domain/status-authority";

export interface ApplyVendorOrderStatusWithMetaParams {
  vendorOrderId: string;
  orderId: string;
  /** Only defined keys are applied to VendorOrder */
  patch: {
    routingStatus?: VendorRoutingStatus;
    fulfillmentStatus?: VendorFulfillmentStatus;
  };
  statusSource: VendorOrderStatusSource;
  /** Legacy string column on VendorOrderStatusHistory.source */
  historySource?: string | null;
  /** When set, updates lastExternalStatus + lastExternalStatusAt. When omitted, those fields are unchanged. */
  externalStatus?: string;
  rawPayload?: unknown;
  /** Merged into prisma.vendorOrder.update data (e.g. lastWebhookPayload) */
  extraVendorOrderUpdate?: Prisma.VendorOrderUpdateInput;
  /** History row routing/fulfillment (usually same as post-patch state) */
  historyRoutingStatus: string;
  historyFulfillmentStatus: string;
  /** When set, history row uses this authority (e.g. admin claiming override in same write). */
  historyAuthority?: VendorOrderStatusAuthority;
  writeHistory?: boolean;
}

function toAuthoritySnapshot(vo: {
  statusAuthority: VendorOrderAuthoritySnapshot["statusAuthority"];
  lastStatusSource: VendorOrderAuthoritySnapshot["lastStatusSource"];
  deliverectChannelLinkId: string | null;
  routingStatus: string;
  manuallyRecoveredAt: Date | null;
  vendor: { deliverectChannelLinkId: string | null };
}): VendorOrderAuthoritySnapshot {
  return {
    statusAuthority: vo.statusAuthority,
    lastStatusSource: vo.lastStatusSource,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendor: vo.vendor,
    routingStatus: vo.routingStatus,
    manuallyRecoveredAt: vo.manuallyRecoveredAt,
  };
}

/**
 * Apply routing/fulfillment patch + instrumentation fields + optional history row, then recompute parent.
 * Caller must pass `orderId` (avoid extra fetch when known).
 */
export async function applyVendorOrderStatusWithMeta(
  params: ApplyVendorOrderStatusWithMetaParams,
  recomputeParentSource: string
): Promise<ParentOrderStatus> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: params.vendorOrderId },
    select: {
      statusAuthority: true,
      lastStatusSource: true,
      deliverectChannelLinkId: true,
      routingStatus: true,
      manuallyRecoveredAt: true,
      vendor: { select: { deliverectChannelLinkId: true } },
    },
  });
  if (!vo) throw new Error("Vendor order not found");

  const authorityForHistory = getEffectiveAuthority(toAuthoritySnapshot(vo));

  const data: Prisma.VendorOrderUpdateInput = {
    ...params.extraVendorOrderUpdate,
    lastStatusSource: params.statusSource,
  };
  if (params.patch.routingStatus !== undefined) {
    data.routingStatus = params.patch.routingStatus;
  }
  if (params.patch.fulfillmentStatus !== undefined) {
    data.fulfillmentStatus = params.patch.fulfillmentStatus;
  }
  if (params.externalStatus !== undefined) {
    data.lastExternalStatus = params.externalStatus;
    data.lastExternalStatusAt = new Date();
  }

  await prisma.vendorOrder.update({
    where: { id: params.vendorOrderId },
    data,
  });

  if (params.writeHistory !== false) {
    await prisma.vendorOrderStatusHistory.create({
      data: {
        vendorOrderId: params.vendorOrderId,
        routingStatus: params.historyRoutingStatus,
        fulfillmentStatus: params.historyFulfillmentStatus,
        source: params.historySource ?? params.statusSource,
        rawPayload: params.rawPayload as object | undefined,
        authority: params.historyAuthority ?? authorityForHistory,
        statusSource: params.statusSource,
        externalStatus: params.externalStatus ?? null,
      },
    });
  }

  const { recomputeAndPersistParentStatus } = await import("@/services/order-status.service");
  // Circular import: TS may infer `void` on the lazy import; runtime return is ParentOrderStatus.
  return (await recomputeAndPersistParentStatus(
    params.orderId,
    recomputeParentSource
  )) as ParentOrderStatus;
}

/** Map legacy history source strings to Prisma VendorOrderStatusSource. */
export function legacySourceToStatusSource(legacy: string): VendorOrderStatusSource {
  switch (legacy) {
    case "vendor_dashboard":
      return "vendor_dashboard";
    case "admin":
    case "admin_manual_recovery":
      return "admin_action";
    case "deliverect":
      return "deliverect_webhook";
    case "deliverect_fallback":
      return "deliverect_fallback";
    case "manual":
      return "system";
    case "dev_simulator":
      return "system";
    default:
      return "system";
  }
}
