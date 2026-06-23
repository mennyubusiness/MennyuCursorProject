import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetVendorOrder = vi.fn();
const mockSubmitOrder = vi.fn();
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockHistoryCreate = vi.fn();
const mockCreateIssue = vi.fn();
const mockGetIssues = vi.fn();
const mockValidateForSubmission = vi.fn();
const mockValidateCanonical = vi.fn();
const mockLoadVariantCounts = vi.fn();
const mockToPayload = vi.fn();
const mockValidatePayload = vi.fn();

vi.mock("@/lib/env", () => ({
  env: { ROUTING_MODE: "deliverect" },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendorOrder: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
    vendorOrderStatusHistory: {
      create: (...args: unknown[]) => mockHistoryCreate(...args),
    },
  },
}));

vi.mock("@/integrations/deliverect/load", () => ({
  getVendorOrderForDeliverect: (...args: unknown[]) => mockGetVendorOrder(...args),
}));

vi.mock("@/integrations/deliverect/client", () => ({
  submitOrder: (...args: unknown[]) => mockSubmitOrder(...args),
}));

vi.mock("@/integrations/deliverect/validate", () => ({
  validateForSubmission: (...args: unknown[]) => mockValidateForSubmission(...args),
  validateLiveMenuItemsAgainstPublishedCanonicalVariantParents: (...args: unknown[]) =>
    mockValidateCanonical(...args),
}));

vi.mock("@/lib/deliverect-variant-child-count", () => ({
  loadVariantChildCountByParentPluForVendor: (...args: unknown[]) => mockLoadVariantCounts(...args),
}));

vi.mock("@/integrations/deliverect/transform", () => ({
  mennyuVendorOrderToDeliverectPayload: (...args: unknown[]) => mockToPayload(...args),
}));

vi.mock("@/integrations/deliverect/payload-validation", () => ({
  validateDeliverectPayload: (...args: unknown[]) => mockValidatePayload(...args),
  buildDeliverectPayloadValidationSnapshot: vi.fn(() => ({})),
  summarizeDeliverectPayloadValidationErrors: vi.fn(() => "summary"),
  describeDeliverectPayloadNestingForDebug: vi.fn(() => ""),
}));

vi.mock("@/services/issues.service", () => ({
  createVendorOrderIssue: (...args: unknown[]) => mockCreateIssue(...args),
  getVendorOrderIssues: (...args: unknown[]) => mockGetIssues(...args),
}));

import { submitVendorOrderToDeliverect } from "./deliverect.service";

const VO_ID = "vo_deliverect_submit";

function baseVendorOrder() {
  return {
    id: VO_ID,
    vendorId: "v_1",
    deliverectAttempts: 0,
    deliverectChannelLinkId: "ch_test",
    vendor: {
      id: "v_1",
      name: "Test Vendor",
      deliverectChannelLinkId: "ch_test",
      deliverectLocationId: null,
    },
    lineItems: [],
  };
}

describe("submitVendorOrderToDeliverect routing outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVendorOrder.mockResolvedValue(baseVendorOrder());
    mockFindUnique.mockResolvedValue({ routingStatus: "pending", deliverectOrderId: null });
    mockValidateForSubmission.mockReturnValue({ valid: true });
    mockValidateCanonical.mockResolvedValue({ valid: true });
    mockLoadVariantCounts.mockResolvedValue(new Map());
    mockToPayload.mockReturnValue({ channelOrderDisplayId: "ord_display_1", items: [] });
    mockValidatePayload.mockReturnValue({ isValid: true, errors: [] });
    mockGetIssues.mockResolvedValue([]);
    mockCreateIssue.mockResolvedValue({ id: "issue_1" });
    mockUpdate.mockResolvedValue({});
    mockHistoryCreate.mockResolvedValue({});
  });

  it("skips duplicate submit when already sent with deliverect order id", async () => {
    mockFindUnique.mockResolvedValue({
      routingStatus: "sent",
      deliverectOrderId: "dlv_existing",
    });

    const result = await submitVendorOrderToDeliverect(VO_ID, "+15551234567", null, 15);

    expect(result).toEqual({ success: true, deliverectOrderId: "dlv_existing" });
    expect(mockSubmitOrder).not.toHaveBeenCalled();
  });

  it("sets routing failed and opens routing_failure issue on submit failure", async () => {
    mockSubmitOrder.mockResolvedValue({
      success: false,
      error: "POS rejected order",
    });

    const result = await submitVendorOrderToDeliverect(VO_ID, "+15551234567", null, 15);

    expect(result.success).toBe(false);
    expect(result.code).toBe("SUBMISSION_FAILED");
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: VO_ID },
        data: expect.objectContaining({
          routingStatus: "failed",
          deliverectLastError: "POS rejected order",
        }),
      })
    );
    expect(mockCreateIssue).toHaveBeenCalledWith(VO_ID, "routing_failure", "HIGH", {
      notes: "POS rejected order",
      createdBy: "system",
    });
    expect(mockHistoryCreate).not.toHaveBeenCalled();
  });

  it("does not move fulfillment on Deliverect submit failure", async () => {
    mockSubmitOrder.mockResolvedValue({ success: false, error: "timeout" });

    await submitVendorOrderToDeliverect(VO_ID, "+15551234567", null, 15);

    const updateData = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(updateData.fulfillmentStatus).toBeUndefined();
    expect(updateData.routingStatus).toBe("failed");
  });

  it("records sent routing history on success without changing fulfillment", async () => {
    mockSubmitOrder.mockResolvedValue({
      success: true,
      externalOrderId: "dlv_new_1",
    });
    mockFindUnique
      .mockResolvedValueOnce({ routingStatus: "pending", deliverectOrderId: null })
      .mockResolvedValueOnce({
        fulfillmentStatus: "pending",
        statusAuthority: null,
        lastStatusSource: null,
        deliverectChannelLinkId: "ch_test",
        routingStatus: "pending",
        manuallyRecoveredAt: null,
        vendor: { deliverectChannelLinkId: "ch_test" },
      });

    const result = await submitVendorOrderToDeliverect(VO_ID, "+15551234567", null, 15);

    expect(result.success).toBe(true);
    expect(mockHistoryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          routingStatus: "sent",
          fulfillmentStatus: "pending",
          source: "deliverect",
        }),
      })
    );
    const routingUpdate = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(routingUpdate.fulfillmentStatus).toBeUndefined();
    expect(routingUpdate.routingStatus).toBe("sent");
  });

  it("does not duplicate routing_failure issue when one is already open", async () => {
    mockSubmitOrder.mockResolvedValue({ success: false, error: "down" });
    mockGetIssues.mockResolvedValue([{ id: "open_1", type: "routing_failure" }]);

    await submitVendorOrderToDeliverect(VO_ID, "+15551234567", null, 15);

    expect(mockCreateIssue).not.toHaveBeenCalled();
  });
});
