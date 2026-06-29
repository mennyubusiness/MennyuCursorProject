import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockSubmitDeliverect = vi.fn();
const mockApplyStatus = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

vi.mock("@/services/deliverect.service", () => ({
  submitVendorOrderToDeliverect: (...args: unknown[]) => mockSubmitDeliverect(...args),
}));

vi.mock("@/services/vendor-order-status-instrumentation", () => ({
  applyVendorOrderStatusWithMeta: (...args: unknown[]) => mockApplyStatus(...args),
}));

import { retryVendorOrderRouting, submitVendorOrder } from "./routing.service";

const VO_ID = "vo_routing_test";
const ORDER_ID = "ord_routing_test";
const PHONE = "+15551234567";
const EMAIL = "guest@example.com";

const baseContext = {
  customerPhone: PHONE,
  customerEmail: EMAIL,
  preparationTimeMinutes: 20,
};

function routingHead(opts?: {
  voChannelLink?: string | null;
  vendorChannelLink?: string | null;
  orderRoutingMode?: "manual_dashboard" | "deliverect";
  busyDelay?: number;
}) {
  return {
    deliverectChannelLinkId: opts?.voChannelLink ?? null,
    vendor: {
      orderRoutingMode: opts?.orderRoutingMode ?? "deliverect",
      deliverectChannelLinkId:
        opts?.vendorChannelLink === undefined ? "ch_deliverect_test" : opts.vendorChannelLink,
      deliverectBusyDelayMinutes: opts?.busyDelay ?? 0,
    },
  };
}

describe("submitVendorOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockApplyStatus.mockResolvedValue("routing");
    mockUpdate.mockResolvedValue({});
  });

  it("returns not found when vendor order is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({ success: false, error: "Vendor order not found" });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });

  it("uses manual path when routing mode is manual_dashboard", async () => {
    mockFindUnique
      .mockResolvedValueOnce(
        routingHead({ orderRoutingMode: "manual_dashboard", vendorChannelLink: "ch_deliverect_test" })
      )
      .mockResolvedValueOnce({
        orderId: ORDER_ID,
        fulfillmentStatus: "pending",
        statusAuthority: null,
      });

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({ success: true, skipped: true });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
    expect(mockApplyStatus).toHaveBeenCalledWith(
      {
        vendorOrderId: VO_ID,
        orderId: ORDER_ID,
        patch: { routingStatus: "confirmed" },
        statusSource: "system",
        historySource: "manual",
        extraVendorOrderUpdate: { statusAuthority: "vendor_manual" },
        historyRoutingStatus: "confirmed",
        historyFulfillmentStatus: "pending",
      },
      "manual"
    );
  });

  it("fails deliverect routing when mode is deliverect but channel link is missing", async () => {
    mockFindUnique.mockResolvedValueOnce(
      routingHead({ orderRoutingMode: "deliverect", vendorChannelLink: null })
    );

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result).toEqual({
      success: false,
      error: "Deliverect routing is configured but channel link is missing.",
      code: "DELIVERECT_NOT_CONFIGURED",
    });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
    expect(mockApplyStatus).not.toHaveBeenCalled();
  });

  it("routes Deliverect-linked vendor through Deliverect submit path", async () => {
    mockFindUnique
      .mockResolvedValueOnce(routingHead())
      .mockResolvedValueOnce({ statusAuthority: null });
    mockSubmitDeliverect.mockResolvedValue({
      success: true,
      deliverectOrderId: "dlv_ord_1",
    });

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(mockSubmitDeliverect).toHaveBeenCalledWith(VO_ID, PHONE, EMAIL, 20);
    expect(result).toEqual({
      success: true,
      externalOrderId: "dlv_ord_1",
      error: undefined,
      code: undefined,
      skipped: undefined,
    });
    expect(mockApplyStatus).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: VO_ID },
      data: {
        lastStatusSource: "system",
        statusAuthority: "vendor_manual",
      },
    });
  });

  it("uses busy delay when it exceeds requested prep time", async () => {
    mockFindUnique
      .mockResolvedValueOnce(routingHead({ busyDelay: 30 }))
      .mockResolvedValueOnce({ statusAuthority: "vendor_manual" });
    mockSubmitDeliverect.mockResolvedValue({ success: true, deliverectOrderId: "dlv_ord_2" });

    await submitVendorOrder(VO_ID, { ...baseContext, preparationTimeMinutes: 15 });

    expect(mockSubmitDeliverect).toHaveBeenCalledWith(VO_ID, PHONE, EMAIL, 30);
  });

  it("propagates Deliverect submit failure without manual confirmation", async () => {
    mockFindUnique.mockResolvedValueOnce(routingHead());
    mockSubmitDeliverect.mockResolvedValue({
      success: false,
      error: "Deliverect API unavailable",
      code: "SUBMISSION_FAILED",
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await submitVendorOrder(VO_ID, baseContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Deliverect API unavailable");
    expect(result.code).toBe("SUBMISSION_FAILED");
    expect(mockApplyStatus).not.toHaveBeenCalled();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    const logged = warnSpy.mock.calls[0]?.[0];
    expect(typeof logged).toBe("string");
    expect(logged).not.toContain("sk_");
    expect(logged).not.toContain("whsec_");
    expect(JSON.parse(String(logged))).toMatchObject({
      event: "submit_vendor_order_failed",
      vendorOrderId: VO_ID,
    });

    warnSpy.mockRestore();
  });

  it("does not overwrite statusAuthority when already set on Deliverect success", async () => {
    mockFindUnique
      .mockResolvedValueOnce(routingHead())
      .mockResolvedValueOnce({ statusAuthority: "pos" });
    mockSubmitDeliverect.mockResolvedValue({ success: true, deliverectOrderId: "dlv_ord_3" });

    await submitVendorOrder(VO_ID, baseContext);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: VO_ID },
      data: { lastStatusSource: "system" },
    });
  });
});

describe("retryVendorOrderRouting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockReset();
    mockSubmitDeliverect.mockResolvedValue({ success: true, deliverectOrderId: "dlv_retry" });
    mockUpdate.mockResolvedValue({});
  });

  it("reloads order context and reuses submitVendorOrder", async () => {
    mockFindUnique
      .mockResolvedValueOnce({
        id: VO_ID,
        order: { customerPhone: PHONE, customerEmail: EMAIL },
      })
      .mockResolvedValueOnce(routingHead())
      .mockResolvedValueOnce({ statusAuthority: null });

    const result = await retryVendorOrderRouting(VO_ID);

    expect(result.success).toBe(true);
    expect(mockSubmitDeliverect).toHaveBeenCalledWith(VO_ID, PHONE, EMAIL, 15);
  });

  it("returns not found when vendor order is missing", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await retryVendorOrderRouting(VO_ID);

    expect(result).toEqual({ success: false, error: "Vendor order not found" });
    expect(mockSubmitDeliverect).not.toHaveBeenCalled();
  });
});
