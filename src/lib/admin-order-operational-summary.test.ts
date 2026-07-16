import { describe, expect, it } from "vitest";
import { getExceptionType } from "./admin-exceptions";
import { getAdminActionState } from "./admin-actions";
import { buildAdminOrderOperationalSummary } from "./admin-order-operational-summary";
import type { AdminOrderDetail } from "./admin-order-detail-query";
import { NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES } from "@/services/issues.service";

function recoveredCompletedOrder(): AdminOrderDetail {
  const recoveredAt = new Date("2026-07-08T21:50:00.000Z");
  return {
    id: "ord_WH6S9AAL_fullid",
    status: "completed",
    createdAt: new Date("2026-07-08T21:47:00.000Z"),
    totalCents: 2500,
    customerEmail: "c@example.com",
    customerPhone: "555",
    adminResolutionNotes: "Vendor confirmed offline",
    issues: [],
    refundAttempts: [],
    orderRefunds: [],
    vendorOrders: [
      {
        id: "vo_1",
        vendorId: "ven_1",
        totalCents: 2500,
        routingStatus: "failed",
        fulfillmentStatus: "completed",
        manuallyRecoveredAt: recoveredAt,
        manuallyRecoveredBy: "admin",
        manualRecoveryNotes: "Called kitchen; order on board",
        squareLastError: "Square Catalog mapping failed",
        deliverectLastError: null,
        squareOrderId: null,
        deliverectOrderId: null,
        statusAuthority: "admin_override",
        statusHistory: [
          {
            id: "h1",
            source: "admin_manual_recovery",
            createdAt: recoveredAt,
            routingStatus: "failed",
            fulfillmentStatus: "accepted",
          },
        ],
        issues: [
          {
            id: "iss_route",
            type: "routing_failure",
            severity: "HIGH",
            status: "RESOLVED",
            notes: "Square failed",
            createdAt: new Date("2026-07-08T21:48:00.000Z"),
            resolvedAt: recoveredAt,
          },
          {
            id: "iss_manual",
            type: "manual_recovery",
            severity: "MEDIUM",
            status: "OPEN",
            notes: "legacy open artifact",
            createdAt: recoveredAt,
            resolvedAt: null,
          },
        ],
        vendor: {
          id: "ven_1",
          name: "Poke Sea",
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
        },
        lineItems: [],
      },
    ],
  } as unknown as AdminOrderDetail;
}

describe("buildAdminOrderOperationalSummary — recovered completed order", () => {
  it("header shows Completed with recovery detail and no attention", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: recoveredCompletedOrder(),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.statusLabel).toBe("Completed");
    expect(summary.statusDetail).toMatch(/Recovered manually after a routing issue/i);
    expect(summary.needsAttention).toBe(false);
    expect(summary.activeIssues.every((i) => i.type !== "manual_recovery")).toBe(true);
    expect(summary.activeIssues).toHaveLength(0);
  });

  it("does not treat historical routing failure as active exception", () => {
    const vo = recoveredCompletedOrder().vendorOrders[0]!;
    expect(getExceptionType(vo)).toBeNull();
    const actions = getAdminActionState(vo, true);
    expect(actions.showRetry).toBe(false);
    expect(actions.showManualRecovery).toBe(false);
  });

  it("vendor summary collapses historical Square failure", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: recoveredCompletedOrder(),
      paymentSummary: null,
      routingAvailable: true,
    });
    const v = summary.vendorSummaries[0]!;
    expect(v.statusLabel).toBe("Completed");
    expect(v.receivedLabel).toMatch(/Confirmed manually/i);
    expect(v.historicalRoutingFailure).not.toBeNull();
    expect(v.showRetry).toBe(false);
  });

  it("does not place contradictory vendor-not-received language in labels", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: recoveredCompletedOrder(),
      paymentSummary: null,
      routingAvailable: true,
    });
    const blob = [
      summary.statusLabel,
      summary.statusDetail,
      summary.health.title,
      summary.health.explanation,
      ...summary.vendorSummaries.map((v) => `${v.statusLabel} ${v.statusDetail} ${v.receivedLabel}`),
    ].join(" ");
    expect(blob).not.toMatch(/Vendor did not receive order/i);
    expect(blob).not.toMatch(/routing failed · fulfillment completed/i);
  });
});

describe("active routing failure still needs attention", () => {
  it("failed unrecovered pending fulfillment shows attention", () => {
    const order = recoveredCompletedOrder();
    order.status = "paid";
    order.vendorOrders[0]!.fulfillmentStatus = "pending";
    order.vendorOrders[0]!.manuallyRecoveredAt = null;
    order.vendorOrders[0]!.manuallyRecoveredBy = null;
    order.vendorOrders[0]!.statusHistory = [];
    order.vendorOrders[0]!.issues = [
      {
        id: "iss_route",
        type: "routing_failure",
        severity: "HIGH",
        status: "OPEN",
        notes: "Square failed",
        createdAt: new Date(),
        resolvedAt: null,
      },
    ] as AdminOrderDetail["vendorOrders"][number]["issues"];

    const summary = buildAdminOrderOperationalSummary({
      order,
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(true);
    expect(summary.statusLabel).toMatch(/attention|Routing failed/i);
    expect(summary.vendorSummaries[0]!.showRetry).toBe(true);
  });
});

describe("issues search exclusion contract", () => {
  it("excludes manual_recovery from actionable vendor issue types", () => {
    expect(NON_ACTIONABLE_VENDOR_ORDER_ISSUE_TYPES).toContain("manual_recovery");
  });
});
