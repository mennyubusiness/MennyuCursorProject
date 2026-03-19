/**
 * Read-only debug snapshot for Deliverect ↔ Mennyu vendor order sync (admin / support).
 */
import { prisma } from "@/lib/db";
import type { DeliverectWebhookLastApplyRecord } from "@/domain/deliverect-webhook-apply";

export interface VendorOrderDeliverectSyncDebug {
  vendorOrderId: string;
  orderId: string;
  routingStatus: string;
  fulfillmentStatus: string;
  statusAuthority: string | null;
  lastStatusSource: string | null;
  lastExternalStatus: string | null;
  lastExternalStatusAt: string | null;
  deliverectOrderId: string | null;
  vendorName: string;
  vendorDeliverectChannelLinkId: string | null;
  /** Parsed from VendorOrder.deliverectWebhookLastApply when shape matches. */
  lastWebhookApply: DeliverectWebhookLastApplyRecord | null;
  recentStatusHistory: Array<{
    id: string;
    createdAt: string;
    routingStatus: string | null;
    fulfillmentStatus: string | null;
    source: string | null;
    authority: string | null;
    statusSource: string | null;
    externalStatus: string | null;
  }>;
}

function parseLastApply(raw: unknown): DeliverectWebhookLastApplyRecord | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const outcome = o.outcome;
  const processedAt = o.processedAt;
  if (typeof outcome !== "string" || typeof processedAt !== "string") return null;
  if (
    outcome !== "applied" &&
    outcome !== "noop_same_status" &&
    outcome !== "ignored_backward" &&
    outcome !== "unmapped_status"
  ) {
    return null;
  }
  return raw as DeliverectWebhookLastApplyRecord;
}

export async function getVendorOrderDeliverectSyncDebug(
  vendorOrderId: string
): Promise<VendorOrderDeliverectSyncDebug | null> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      statusAuthority: true,
      lastStatusSource: true,
      lastExternalStatus: true,
      lastExternalStatusAt: true,
      deliverectOrderId: true,
      deliverectWebhookLastApply: true,
      vendor: { select: { name: true, deliverectChannelLinkId: true } },
      statusHistory: {
        orderBy: { createdAt: "desc" },
        take: 15,
        select: {
          id: true,
          createdAt: true,
          routingStatus: true,
          fulfillmentStatus: true,
          source: true,
          authority: true,
          statusSource: true,
          externalStatus: true,
        },
      },
    },
  });
  if (!vo) return null;

  return {
    vendorOrderId: vo.id,
    orderId: vo.orderId,
    routingStatus: vo.routingStatus,
    fulfillmentStatus: vo.fulfillmentStatus,
    statusAuthority: vo.statusAuthority,
    lastStatusSource: vo.lastStatusSource,
    lastExternalStatus: vo.lastExternalStatus,
    lastExternalStatusAt: vo.lastExternalStatusAt?.toISOString() ?? null,
    deliverectOrderId: vo.deliverectOrderId,
    vendorName: vo.vendor.name,
    vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
    lastWebhookApply: parseLastApply(vo.deliverectWebhookLastApply),
    recentStatusHistory: vo.statusHistory.map((h) => ({
      id: h.id,
      createdAt: h.createdAt.toISOString(),
      routingStatus: h.routingStatus,
      fulfillmentStatus: h.fulfillmentStatus,
      source: h.source,
      authority: h.authority,
      statusSource: h.statusSource,
      externalStatus: h.externalStatus,
    })),
  };
}
