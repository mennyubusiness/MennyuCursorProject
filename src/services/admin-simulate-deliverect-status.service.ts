import "server-only";

import {
  evaluateSimulateDeliverectStatusEligibility,
  isAllowedSimulateDeliverectStatusCode,
} from "@/lib/admin-simulate-deliverect-status";
import { prisma } from "@/lib/db";
import { applyDeliverectOrderStatusUpdate } from "@/services/deliverect-order-status.service";

export type SimulateDeliverectStatusResult =
  | {
      ok: true;
      vendorOrderId: string;
      orderId: string;
      statusCode: number;
      mappedFulfillmentStatus: string | null;
      mappedRoutingStatus: string | null;
      outcome: string;
    }
  | { ok: false; code: string; error: string };

export async function simulateVendorOrderDeliverectStatus(
  vendorOrderId: string,
  statusCode: number,
  note?: string
): Promise<SimulateDeliverectStatusResult> {
  if (!isAllowedSimulateDeliverectStatusCode(statusCode)) {
    return {
      ok: false,
      code: "INVALID_STATUS_CODE",
      error: "Unsupported Deliverect status code.",
    };
  }

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      deliverectChannelLinkId: true,
      deliverectOrderId: true,
      order: { select: { status: true } },
      vendor: { select: { deliverectChannelLinkId: true } },
    },
  });

  if (!vo) {
    return { ok: false, code: "NOT_FOUND", error: "Vendor order not found" };
  }

  const eligibility = evaluateSimulateDeliverectStatusEligibility({
    orderStatus: vo.order.status,
    fulfillmentStatus: vo.fulfillmentStatus,
    routingStatus: vo.routingStatus,
    statusCode,
    deliverectChannelLinkId: vo.deliverectChannelLinkId,
    vendorDeliverectChannelLinkId: vo.vendor.deliverectChannelLinkId,
    deliverectOrderId: vo.deliverectOrderId,
  });
  if (!eligibility.eligible) {
    return { ok: false, code: eligibility.code, error: eligibility.message };
  }

  const apply = await applyDeliverectOrderStatusUpdate({
    vendorOrderId: vo.id,
    statusCode,
    source: "admin_simulator",
    note: note?.trim() || undefined,
  });

  return {
    ok: true,
    vendorOrderId: vo.id,
    orderId: vo.orderId,
    statusCode,
    mappedFulfillmentStatus: apply.mappedFulfillmentStatus,
    mappedRoutingStatus: apply.mappedRoutingStatus,
    outcome: apply.outcome,
  };
}
