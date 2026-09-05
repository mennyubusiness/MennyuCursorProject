import { describe, expect, it } from "vitest";
import {
  deriveAdminOrderIssueAttention,
  historicalFailedVendorReceiveDetail,
  orderNeedsAdminAttentionFromIssues,
} from "./admin-order-issue-attention";
import { adminPodPrimaryOrderState } from "./admin-pod-summary";
import { buildAdminOrderOperationalSummary } from "./admin-order-operational-summary";
import type { AdminOrderDetail } from "./admin-order-detail-query";

function baseMultiVendorOrder(overrides?: {
  failedIssueStatus?: string;
  failedFulfillment?: string;
  extraOpenIssue?: { type: string; status: string };
}): AdminOrderDetail {
  const failedIssueStatus = overrides?.failedIssueStatus ?? "OPEN";
  const failedFulfillment = overrides?.failedFulfillment ?? "pending";
  const issues: AdminOrderDetail["vendorOrders"][number]["issues"] = [
    {
      id: "iss_route",
      type: "routing_failure",
      severity: "HIGH",
      status: failedIssueStatus,
      notes: "Could not route",
      createdAt: new Date("2026-09-04T12:00:00.000Z"),
      resolvedAt: failedIssueStatus === "RESOLVED" ? new Date("2026-09-04T13:00:00.000Z") : null,
    },
  ];
  if (overrides?.extraOpenIssue) {
    issues.push({
      id: "iss_extra",
      type: overrides.extraOpenIssue.type,
      severity: "MEDIUM",
      status: overrides.extraOpenIssue.status,
      notes: null,
      createdAt: new Date("2026-09-04T13:30:00.000Z"),
      resolvedAt: null,
    } as AdminOrderDetail["vendorOrders"][number]["issues"][number]);
  }

  return {
    id: "ord_xxxxGNORAW",
    status: "paid",
    createdAt: new Date("2026-09-04T12:00:00.000Z"),
    totalCents: 4000,
    customerEmail: "c@example.com",
    customerPhone: "555",
    adminResolutionNotes: null,
    issues: [],
    refundAttempts: [],
    orderRefunds: [],
    vendorOrders: [
      {
        id: "vo_ok",
        vendorId: "ven_ok",
        totalCents: 2000,
        routingStatus: "confirmed",
        fulfillmentStatus: "completed",
        manuallyRecoveredAt: null,
        manuallyRecoveredBy: null,
        manualRecoveryNotes: null,
        squareLastError: null,
        deliverectLastError: null,
        squareOrderId: null,
        deliverectOrderId: null,
        statusAuthority: null,
        statusHistory: [],
        issues: [],
        vendor: {
          id: "ven_ok",
          name: "Good Vendor",
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
        },
        lineItems: [],
      },
      {
        id: "vo_fail",
        vendorId: "ven_fail",
        totalCents: 2000,
        routingStatus: "failed",
        fulfillmentStatus: failedFulfillment,
        manuallyRecoveredAt: null,
        manuallyRecoveredBy: null,
        manualRecoveryNotes: null,
        squareLastError: "Routing failed",
        deliverectLastError: null,
        squareOrderId: null,
        deliverectOrderId: null,
        statusAuthority: null,
        statusHistory: [],
        issues,
        vendor: {
          id: "ven_fail",
          name: "Failed Vendor",
          orderRoutingMode: "square",
          deliverectChannelLinkId: null,
        },
        lineItems: [],
      },
    ],
  } as unknown as AdminOrderDetail;
}

describe("deriveAdminOrderIssueAttention", () => {
  it("A: routing failure + unresolved issue -> hasActiveIssues", () => {
    const attention = deriveAdminOrderIssueAttention({
      vendorOrderIssues: [{ status: "OPEN", type: "routing_failure" }],
    });
    expect(attention.kind).toBe("hasActiveIssues");
    expect(attention.hasActiveIssues).toBe(true);
    expect(orderNeedsAdminAttentionFromIssues({
      vendorOrderIssues: [{ status: "OPEN", type: "routing_failure" }],
    })).toBe(true);
  });

  it("B: routing failure + issue resolved -> hasResolvedIssueHistory, not needs attention", () => {
    const attention = deriveAdminOrderIssueAttention({
      vendorOrderIssues: [{ status: "RESOLVED", type: "routing_failure" }],
    });
    expect(attention.kind).toBe("hasResolvedIssueHistory");
    expect(attention.hasActiveIssues).toBe(false);
    expect(orderNeedsAdminAttentionFromIssues({
      vendorOrderIssues: [{ status: "RESOLVED", type: "routing_failure" }],
    })).toBe(false);
  });

  it("ignores legacy open manual_recovery artifacts", () => {
    const attention = deriveAdminOrderIssueAttention({
      vendorOrderIssues: [{ status: "OPEN", type: "manual_recovery" }],
    });
    expect(attention.hasActiveIssues).toBe(false);
    expect(attention.hasResolvedIssueHistory).toBe(true);
  });

  it("E: refunded order with a separate unresolved issue -> still needs attention", () => {
    expect(
      orderNeedsAdminAttentionFromIssues({
        vendorOrderIssues: [
          { status: "RESOLVED", type: "routing_failure" },
          { status: "OPEN", type: "partial_order" },
        ],
      })
    ).toBe(true);
  });

  it("F: resolved history remains detectable", () => {
    const attention = deriveAdminOrderIssueAttention({
      vendorOrderIssues: [
        { status: "RESOLVED", type: "routing_failure" },
        { status: "RESOLVED", type: "vendor_cancelled" },
      ],
    });
    expect(attention.kind).toBe("hasResolvedIssueHistory");
    expect(attention.resolvedCount).toBe(2);
    expect(historicalFailedVendorReceiveDetail(
      [
        { routingStatus: "confirmed" },
        { routingStatus: "failed" },
      ],
      { resolved: true }
    )).toMatch(/1 of 2 vendors failed.*handled/);
  });
});

describe("adminPodPrimaryOrderState — issue-based Needs attention", () => {
  it("A: open routing issue keeps Needs attention + failure detail", () => {
    const state = adminPodPrimaryOrderState({
      status: "paid",
      vendorOrders: [
        { routingStatus: "confirmed", fulfillmentStatus: "completed", issues: [] },
        {
          routingStatus: "failed",
          fulfillmentStatus: "pending",
          issues: [{ status: "OPEN", type: "routing_failure" }],
        },
      ],
    });
    expect(state.label).toBe("Needs attention");
    expect(state.detail).toMatch(/1 of 2 vendors failed/);
  });

  it("B: resolved routing issue does not show Needs attention", () => {
    const state = adminPodPrimaryOrderState({
      status: "paid",
      vendorOrders: [
        { routingStatus: "confirmed", fulfillmentStatus: "completed", issues: [] },
        {
          routingStatus: "failed",
          fulfillmentStatus: "pending",
          issues: [{ status: "RESOLVED", type: "routing_failure" }],
        },
      ],
    });
    expect(state.label).not.toBe("Needs attention");
    expect(state.detail).toMatch(/1 of 2 vendors failed/);
  });

  it("C/D: cancelled vendor + resolved issues -> Resolved, not Needs attention", () => {
    const state = adminPodPrimaryOrderState({
      status: "paid",
      vendorOrders: [
        { routingStatus: "confirmed", fulfillmentStatus: "completed", issues: [] },
        {
          routingStatus: "failed",
          fulfillmentStatus: "cancelled",
          issues: [
            { status: "RESOLVED", type: "routing_failure" },
            { status: "RESOLVED", type: "vendor_cancelled" },
          ],
        },
      ],
    });
    expect(state.label).toBe("Resolved");
    expect(state.tone).not.toBe("danger");
    expect(state.detail).toMatch(/1 of 2 vendors failed/);
  });

  it("does not treat historical routingStatus=failed alone as Needs attention when issues omitted and none open", () => {
    // Without issue rows, hasActiveIssues is false — historical failure is not enough.
    const state = adminPodPrimaryOrderState({
      status: "paid",
      vendorOrders: [
        { routingStatus: "confirmed", fulfillmentStatus: "completed" },
        { routingStatus: "failed", fulfillmentStatus: "cancelled" },
      ],
    });
    expect(state.label).not.toBe("Needs attention");
  });
});

describe("buildAdminOrderOperationalSummary — consistent with issue SoT", () => {
  it("A: routing failure + unresolved issue -> Needs attention", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: baseMultiVendorOrder({ failedIssueStatus: "OPEN" }),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(true);
    expect(summary.issueAttentionKind).toBe("hasActiveIssues");
    expect(summary.statusLabel).toBe("Needs attention");
    expect(summary.activeIssueCount).toBeGreaterThan(0);
  });

  it("B: routing failure + issue resolved -> not Needs attention", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: baseMultiVendorOrder({ failedIssueStatus: "RESOLVED", failedFulfillment: "pending" }),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(false);
    expect(summary.issueAttentionKind).toBe("hasResolvedIssueHistory");
    expect(summary.statusLabel).not.toBe("Needs attention");
    expect(summary.resolvedIssues.length).toBeGreaterThan(0);
  });

  it("C: cancelled vendor + resolved issues -> not Needs attention", () => {
    const order = baseMultiVendorOrder({
      failedIssueStatus: "RESOLVED",
      failedFulfillment: "cancelled",
    });
    order.vendorOrders[1]!.issues.push({
      id: "iss_cancel",
      type: "vendor_cancelled",
      severity: "MEDIUM",
      status: "RESOLVED",
      notes: "Cancelled after refund",
      createdAt: new Date("2026-09-04T13:10:00.000Z"),
      resolvedAt: new Date("2026-09-04T13:15:00.000Z"),
    });
    const summary = buildAdminOrderOperationalSummary({
      order,
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(false);
    expect(summary.statusLabel).toMatch(/Resolved|Completed/);
    expect(summary.activeIssues).toHaveLength(0);
    expect(summary.resolvedIssues.length).toBeGreaterThan(0);
    expect(summary.statusDetail).toMatch(/1 of 2 vendors failed/);
  });

  it("D: one completed + one failed/refunded, all issues resolved -> not Needs attention", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: baseMultiVendorOrder({
        failedIssueStatus: "RESOLVED",
        failedFulfillment: "cancelled",
      }),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(false);
    expect(summary.vendorSummaries.some((v) => v.statusKey === "completed")).toBe(true);
    expect(summary.vendorSummaries.some((v) => v.statusKey === "cancelled")).toBe(true);
  });

  it("E: refunded/cancelled vendor with separate unresolved issue -> still Needs attention", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: baseMultiVendorOrder({
        failedIssueStatus: "RESOLVED",
        failedFulfillment: "cancelled",
        extraOpenIssue: { type: "partial_order", status: "OPEN" },
      }),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.needsAttention).toBe(true);
    expect(summary.statusLabel).toBe("Needs attention");
    expect(summary.activeIssues.some((i) => i.type === "partial_order")).toBe(true);
  });

  it("F: resolved issue history remains visible", () => {
    const summary = buildAdminOrderOperationalSummary({
      order: baseMultiVendorOrder({
        failedIssueStatus: "RESOLVED",
        failedFulfillment: "cancelled",
      }),
      paymentSummary: null,
      routingAvailable: true,
    });
    expect(summary.resolvedIssues.some((i) => i.type === "routing_failure")).toBe(true);
    expect(summary.issueAttentionKind).toBe("hasResolvedIssueHistory");
  });
});
