import "server-only";

import { prisma } from "@/lib/db";
import {
  evaluateSimulateRoutingFailureEligibility,
  SIMULATED_ROUTING_FAILURE_MESSAGE,
} from "@/lib/admin-simulate-routing-failure";
import { applyVendorOrderStatusWithMeta } from "@/services/vendor-order-status-instrumentation";
import {
  createVendorOrderIssue,
  getVendorOrderIssues,
} from "@/services/issues.service";

export type SimulateRoutingFailureResult =
  | {
      ok: true;
      vendorOrderId: string;
      orderId: string;
      routingStatus: string;
      fulfillmentStatus: string;
      parentStatus: string;
    }
  | { ok: false; code: string; error: string };

export async function simulateVendorOrderRoutingFailure(
  vendorOrderId: string
): Promise<SimulateRoutingFailureResult> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      orderId: true,
      routingStatus: true,
      fulfillmentStatus: true,
      deliverectAttempts: true,
      order: { select: { status: true } },
    },
  });

  if (!vo) {
    return { ok: false, code: "NOT_FOUND", error: "Vendor order not found" };
  }

  const eligibility = evaluateSimulateRoutingFailureEligibility({
    orderStatus: vo.order.status,
    fulfillmentStatus: vo.fulfillmentStatus,
  });
  if (!eligibility.eligible) {
    return { ok: false, code: eligibility.code, error: eligibility.message };
  }

  const parentStatus = await applyVendorOrderStatusWithMeta(
    {
      vendorOrderId: vo.id,
      orderId: vo.orderId,
      patch: { routingStatus: "failed" },
      statusSource: "system",
      historySource: "admin_simulate_routing_failure",
      historyRoutingStatus: "failed",
      historyFulfillmentStatus: vo.fulfillmentStatus,
      extraVendorOrderUpdate: {
        deliverectLastError: SIMULATED_ROUTING_FAILURE_MESSAGE,
        deliverectAttempts: vo.deliverectAttempts + 1,
      },
      rawPayload: {
        kind: "admin_simulate_routing_failure",
        summary: SIMULATED_ROUTING_FAILURE_MESSAGE,
        previousRoutingStatus: vo.routingStatus,
      },
    },
    "admin_simulate_routing_failure"
  );

  const openIssues = await getVendorOrderIssues(vendorOrderId, "OPEN");
  if (!openIssues.some((i) => i.type === "routing_failure")) {
    await createVendorOrderIssue(vendorOrderId, "routing_failure", "HIGH", {
      notes: SIMULATED_ROUTING_FAILURE_MESSAGE,
      createdBy: "admin",
    });
  }

  return {
    ok: true,
    vendorOrderId: vo.id,
    orderId: vo.orderId,
    routingStatus: "failed",
    fulfillmentStatus: vo.fulfillmentStatus,
    parentStatus,
  };
}
