import { describe, expect, it } from "vitest";

import { shouldApplyStatusUpdate } from "@/domain/status-authority";
import {
  canVendorDashboardMutateVendorOrder,
  isDeliverectAuthoritativeVendorOrder,
} from "@/lib/deliverect-vendor-order-authority";
import {
  canVendorDashboardMutateFromPolicy,
  getKitchenActionPolicy,
  vendorKitchenActionBlockedMessage,
} from "@/lib/order-routing/kitchen-action-policy";

const manualVendor = { orderRoutingMode: "manual_dashboard" as const };
const squareVendor = { orderRoutingMode: "square" as const };
const deliverectVendor = {
  orderRoutingMode: "deliverect" as const,
  deliverectChannelLinkId: "ch_1",
};

const baseOrder = {
  routingStatus: "confirmed",
  fulfillmentStatus: "pending",
  manuallyRecoveredAt: null as Date | null,
  statusAuthority: "pos" as const,
  deliverectChannelLinkId: "ch_1",
  vendor: { deliverectChannelLinkId: "ch_1" },
};

describe("getKitchenActionPolicy", () => {
  it("manual/tablet vendor keeps kitchen actions enabled", () => {
    const policy = getKitchenActionPolicy(manualVendor, {
      routingStatus: "confirmed",
      fulfillmentStatus: "pending",
      squareOrderId: "sq_1",
    });
    expect(policy.actionsLocked).toBe(false);
    expect(policy.managedOrderBadge).toBe("Managed in Open Order");
    expect(policy.showProviderManagedState).toBe(false);
  });

  it("locks Square-routed order with squareOrderId", () => {
    const policy = getKitchenActionPolicy(
      squareVendor,
      {
        routingStatus: "sent",
        fulfillmentStatus: "pending",
        squareOrderId: "sq_123",
      },
      { squareStatusSyncConfigured: true }
    );
    expect(policy.actionsLocked).toBe(true);
    expect(policy.provider).toBe("square");
    expect(policy.managedOrderBadge).toBe("Managed in Square");
    expect(policy.showProviderManagedState).toBe(true);
    expect(policy.kitchenLockTooltip).toMatch(/Manage this order in Square/);
    expect(policy.kitchenLockTooltip).not.toMatch(/Deliverect/);
  });

  it("locks Square-routed sent order without squareOrderId when routing succeeded", () => {
    const policy = getKitchenActionPolicy(squareVendor, {
      routingStatus: "sent",
      fulfillmentStatus: "pending",
      squareOrderId: null,
    });
    expect(policy.actionsLocked).toBe(true);
  });

  it("Square routing failed without external id shows recovery copy not managed badge", () => {
    const policy = getKitchenActionPolicy(
      squareVendor,
      {
        routingStatus: "failed",
        fulfillmentStatus: "pending",
        squareOrderId: null,
      },
      { squareStatusSyncConfigured: true }
    );
    expect(policy.actionsLocked).toBe(false);
    expect(policy.routingFailed).toBe(true);
    expect(policy.recoveryCopy).toMatch(/Routing failed/);
    expect(policy.showProviderManagedState).toBe(false);
    expect(policy.managedOrderBadge).toBeNull();
  });

  it("locks Deliverect-routed channel-linked order", () => {
    const policy = getKitchenActionPolicy(
      deliverectVendor,
      {
        ...baseOrder,
        deliverectOrderId: "dct_1",
      },
      { deliverectRoutingLive: true }
    );
    expect(policy.actionsLocked).toBe(true);
    expect(policy.provider).toBe("deliverect");
    expect(policy.managedOrderBadge).toBe("Managed in Deliverect");
    expect(policy.kitchenLockTooltip).toMatch(/Deliverect/);
    expect(policy.kitchenLockTooltip).not.toMatch(/Square/);
  });

  it("Deliverect routing failed without external id shows recovery copy", () => {
    const policy = getKitchenActionPolicy(deliverectVendor, {
      routingStatus: "failed",
      fulfillmentStatus: "pending",
      deliverectOrderId: null,
      deliverectChannelLinkId: "ch_1",
      vendor: { deliverectChannelLinkId: "ch_1" },
    });
    expect(policy.actionsLocked).toBe(false);
    expect(policy.routingFailed).toBe(true);
    expect(policy.recoveryCopy).toMatch(/Routing failed/);
    expect(policy.showProviderManagedState).toBe(false);
  });

  it("admin manual recovery unlocks kitchen actions", () => {
    const policy = getKitchenActionPolicy(squareVendor, {
      routingStatus: "sent",
      fulfillmentStatus: "accepted",
      squareOrderId: "sq_1",
      manuallyRecoveredAt: new Date(),
      statusAuthority: "admin_override",
    });
    expect(policy.actionsLocked).toBe(false);
    expect(policy.recoveryAllowed).toBe(true);
  });

  it("uses provider-specific status sync copy for Square without webhook", () => {
    const policy = getKitchenActionPolicy(
      squareVendor,
      { routingStatus: "sent", squareOrderId: "sq_1" },
      { squareStatusSyncConfigured: false }
    );
    expect(policy.statusSyncAvailable).toBe(false);
    expect(policy.statusSyncCopy).toMatch(/Webhook sync is not configured/);
    expect(policy.kitchenLockTooltip).toMatch(/Webhook sync is not configured/);
  });

  it("Square sync true shows sync-enabled copy", () => {
    const policy = getKitchenActionPolicy(
      squareVendor,
      { routingStatus: "sent", squareOrderId: "sq_1" },
      { squareStatusSyncConfigured: true }
    );
    expect(policy.statusSyncAvailable).toBe(true);
    expect(policy.statusSyncCopy).toBe("Status updates from Square will update Open Order.");
    expect(policy.kitchenLockTooltip).toMatch(/Updates from Square will sync back/);
    expect(policy.statusSyncCopy).not.toMatch(/not configured/i);
  });

  it("Square sync omitted/null does not claim webhooks are missing", () => {
    const omitted = getKitchenActionPolicy(squareVendor, {
      routingStatus: "sent",
      squareOrderId: "sq_1",
    });
    expect(omitted.statusSyncAvailable).toBeNull();
    expect(omitted.statusSyncCopy).toBe("Open Order will update when status sync is available.");
    expect(omitted.kitchenLockTooltip).toMatch(/when status sync is available/);
    expect(omitted.statusSyncCopy).not.toMatch(/not configured/i);
    expect(omitted.kitchenLockTooltip).not.toMatch(/not configured/i);

    const explicitNull = getKitchenActionPolicy(
      squareVendor,
      { routingStatus: "sent", squareOrderId: "sq_1" },
      { squareStatusSyncConfigured: null }
    );
    expect(explicitNull.statusSyncAvailable).toBeNull();
    expect(explicitNull.statusSyncCopy).not.toMatch(/not configured/i);
  });

  it("Deliverect sync omitted/null uses neutral copy", () => {
    const policy = getKitchenActionPolicy(deliverectVendor, {
      ...baseOrder,
      deliverectOrderId: "dct_1",
    });
    expect(policy.statusSyncAvailable).toBeNull();
    expect(policy.statusSyncCopy).toBe("Open Order will update when status sync is available.");
    expect(policy.statusSyncCopy).not.toMatch(/admin recovery/i);
  });

  it("manual vendors show no external lock warning", () => {
    const policy = getKitchenActionPolicy(manualVendor, {
      routingStatus: "confirmed",
      fulfillmentStatus: "preparing",
    });
    expect(policy.kitchenLockTooltip).toBeNull();
    expect(policy.statusSyncCopy).toBeNull();
    expect(policy.recoveryCopy).toBeNull();
    expect(policy.statusSyncAvailable).toBeNull();
  });
});

describe("canVendorDashboardMutateVendorOrder integration", () => {
  it("rejects locked Square order for vendor dashboard", () => {
    const vo = {
      ...baseOrder,
      routingStatus: "sent",
      squareOrderId: "sq_1",
      deliverectChannelLinkId: null,
      vendor: { deliverectChannelLinkId: null },
    };
    expect(canVendorDashboardMutateVendorOrder(vo, "square")).toBe(false);
    const policy = getKitchenActionPolicy(squareVendor, {
      routingStatus: "sent",
      squareOrderId: "sq_1",
    });
    expect(vendorKitchenActionBlockedMessage(policy)).toMatch(/Square/);
  });

  it("rejects locked Deliverect order for vendor dashboard", () => {
    expect(
      canVendorDashboardMutateVendorOrder(
        { ...baseOrder, deliverectOrderId: "dct_1" },
        "deliverect",
        { deliverectRoutingLive: true }
      )
    ).toBe(false);
    expect(isDeliverectAuthoritativeVendorOrder(baseOrder, "deliverect")).toBe(true);
  });

  it("allows manual dashboard vendor mutations", () => {
    expect(
      canVendorDashboardMutateVendorOrder(
        { ...baseOrder, squareOrderId: "sq_1", deliverectOrderId: "dct_1" },
        "manual_dashboard"
      )
    ).toBe(true);
  });
});

describe("status authority square webhook", () => {
  it("allows square_webhook updates on pos-managed orders", () => {
    const result = shouldApplyStatusUpdate(
      {
        statusAuthority: "pos",
        routingStatus: "sent",
        deliverectChannelLinkId: null,
      },
      "square_webhook"
    );
    expect(result).toEqual({ allowed: true });
  });

  it("blocks vendor_dashboard on pos authority", () => {
    const result = shouldApplyStatusUpdate(
      {
        statusAuthority: "pos",
        routingStatus: "sent",
        deliverectChannelLinkId: "ch_1",
        vendor: { deliverectChannelLinkId: "ch_1" },
      },
      "vendor_dashboard"
    );
    expect(result).toEqual({ allowed: false, reason: "POS_MANAGED_USE_FALLBACK" });
  });
});

describe("canVendorDashboardMutateFromPolicy", () => {
  it("allows degraded routing confirm override when requested", () => {
    const locked = getKitchenActionPolicy(squareVendor, {
      routingStatus: "sent",
      squareOrderId: "sq_1",
    });
    expect(locked.actionsLocked).toBe(true);
    expect(
      canVendorDashboardMutateFromPolicy(
        squareVendor,
        { routingStatus: "sent", squareOrderId: "sq_1" },
        undefined,
        { allowDegradedRoutingConfirm: true }
      )
    ).toBe(true);
  });
});
