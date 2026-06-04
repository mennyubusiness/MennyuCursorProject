import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  adminGroupOrderLineAttributionLabel,
  adminGroupOrderRefundLineDescription,
  buildAdminOrderGroupContext,
  formatAdminGroupOrderStatus,
} from "./admin-order-group-context";
import type { AdminOrderDetail } from "./admin-order-detail-query";

function mockGroupOrderDetail(): AdminOrderDetail {
  return {
    id: "ord_1",
    createdAt: new Date("2026-06-04T12:00:00Z"),
    status: "paid",
    customerPhone: "+15551230000",
    customerEmail: "host@example.com",
    orderNotes: null,
    adminResolutionNotes: null,
    subtotalCents: 5000,
    totalCents: 5500,
    groupOrderSessionId: "gos_1",
    groupOrderSession: {
      id: "gos_1",
      joinCode: "123456",
      status: "submitted",
      lockedAt: new Date("2026-06-04T12:01:00Z"),
      expiresAt: new Date("2026-06-05T12:00:00Z"),
      createdAt: new Date("2026-06-04T11:00:00Z"),
      updatedAt: new Date("2026-06-04T12:02:00Z"),
      host: { id: "user_host", name: "Host User", email: "host@example.com" },
      participants: [
        {
          id: "part_host",
          role: "host",
          displayName: "Host User",
          phoneE164: null,
          userId: "user_host",
          leftAt: null,
          user: { email: "host@example.com" },
        },
        {
          id: "part_alex",
          role: "participant",
          displayName: "Alex",
          phoneE164: "+15559876543",
          userId: null,
          leftAt: null,
          user: null,
        },
      ],
    },
    pod: { id: "pod_1", name: "Test Pod" },
    statusHistory: [],
    issues: [],
    orderRefunds: [],
    refundAttempts: [],
    vendorOrders: [
      {
        id: "vo_1",
        orderId: "ord_1",
        vendorId: "v_1",
        createdAt: new Date(),
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        totalCents: 5500,
        manuallyRecoveredAt: null,
        manualRecoveryNotes: null,
        deliverectAttempts: 0,
        deliverectSubmittedAt: null,
        deliverectLastError: null,
        deliverectOrderId: null,
        lastExternalStatusAt: null,
        lastExternalStatus: null,
        statusAuthority: null,
        lastStatusSource: null,
        lastDeliverectResponse: null,
        deliverectWebhookLastApply: null,
        lastWebhookPayload: null,
        deliverectAutoRecheckAttemptedAt: null,
        deliverectAutoRecheckResult: null,
        deliverectChannelLinkId: null,
        deliverectPayloadValidation: null,
        vendor: { id: "v_1", name: "Vendor A", deliverectChannelLinkId: null },
        issues: [],
        statusHistory: [],
        lineItems: [
          {
            id: "li_host",
            name: "Host Burger",
            quantity: 1,
            priceCents: 2000,
            specialInstructions: null,
            groupOrderParticipantId: "part_host",
            selections: [],
          },
          {
            id: "li_alex",
            name: "Build your own Pizza",
            quantity: 1,
            priceCents: 3000,
            specialInstructions: null,
            groupOrderParticipantId: "part_alex",
            selections: [],
          },
        ],
      },
    ],
  } as AdminOrderDetail;
}

describe("buildAdminOrderGroupContext", () => {
  it("returns null when order has no group session", () => {
    const detail = mockGroupOrderDetail();
    detail.groupOrderSessionId = null;
    detail.groupOrderSession = null;
    expect(buildAdminOrderGroupContext(detail)).toBeNull();
  });

  it("builds host and participant rows with masked phone", () => {
    const ctx = buildAdminOrderGroupContext(mockGroupOrderDetail());
    expect(ctx).not.toBeNull();
    expect(ctx!.joinCode).toBe("123456");
    expect(ctx!.hostDisplayName).toBe("Host User");
    expect(ctx!.participantCount).toBe(2);
    expect(ctx!.activeParticipantCount).toBe(2);
    const alex = ctx!.participantById.get("part_alex");
    expect(alex?.displayName).toBe("Alex");
    expect(alex?.phoneMasked).toBe("+1 ••• ••• 6543");
    expect(alex?.role).toBe("participant");
  });

  it("labels line items by participant", () => {
    const ctx = buildAdminOrderGroupContext(mockGroupOrderDetail())!;
    expect(adminGroupOrderLineAttributionLabel("part_host", ctx)).toBe("Host");
    expect(adminGroupOrderLineAttributionLabel("part_alex", ctx)).toBe("For Alex");
    expect(adminGroupOrderRefundLineDescription("Pizza", 1, "part_alex", ctx)).toBe(
      "Pizza × 1 · For Alex"
    );
  });

  it("formats session status for display", () => {
    expect(formatAdminGroupOrderStatus("locked_checkout")).toBe("Locked checkout");
  });
});

describe("admin order detail group UI sources", () => {
  const root = join(process.cwd(), "src/app/admin/(dashboard)/orders/[orderId]");
  const pageSrc = readFileSync(join(root, "page.tsx"), "utf8");
  const panelSrc = readFileSync(join(root, "AdminOrderGroupOrderPanel.tsx"), "utf8");
  const querySrc = readFileSync(
    join(process.cwd(), "src/lib/admin-order-detail-query.ts"),
    "utf8"
  );
  const paymentsSrc = readFileSync(join(root, "AdminPaymentsRefundsPanel.tsx"), "utf8");

  it("renders group panel only when context exists", () => {
    expect(pageSrc).toMatch(
      /\{groupOrderContext \? <AdminOrderGroupOrderPanel context=\{groupOrderContext\} \/> : null\}/
    );
  });

  it("shows Group order badge in header and panel", () => {
    expect(pageSrc).toMatch(/groupOrderContext=\{groupOrderContext\}/);
    expect(panelSrc).toMatch(/Group order/);
    expect(panelSrc).toMatch(/Host paid for this group order/);
  });

  it("does not select or render joinToken", () => {
    expect(querySrc).not.toMatch(/joinToken/);
    expect(panelSrc).not.toMatch(/joinToken/);
    expect(paymentsSrc).not.toMatch(/joinToken/);
  });

  it("loads group session and line attribution in admin query", () => {
    expect(querySrc).toMatch(/groupOrderSession:/);
    expect(querySrc).toMatch(/groupOrderParticipantId: true/);
  });

  it("shows participant attribution on refund line rows", () => {
    expect(paymentsSrc).toMatch(/adminGroupOrderRefundLineDescription/);
  });

  it("includes group session id in technical details", () => {
    const technicalSrc = readFileSync(join(root, "AdminOrderTechnicalDetailsSection.tsx"), "utf8");
    expect(technicalSrc).toMatch(/Group order session/);
    expect(technicalSrc).toMatch(/groupOrderContext\.sessionId/);
  });
});
