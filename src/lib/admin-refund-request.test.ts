import { describe, expect, it } from "vitest";
import { parseAdminRefundRequestBody } from "./admin-refund-request";

describe("parseAdminRefundRequestBody", () => {
  it("parses full_order scope", () => {
    const r = parseAdminRefundRequestBody({
      scope: "full_order",
      reason: "duplicate charge",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.scope).toBe("full_order");
      expect(r.data.reason).toBe("duplicate charge");
    }
  });

  it("requires vendorOrderId for vendor scopes", () => {
    const r = parseAdminRefundRequestBody({
      scope: "full_vendor_order",
      reason: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("requires amountCents for custom partial", () => {
    const r = parseAdminRefundRequestBody({
      scope: "custom_vendor_partial",
      vendorOrderId: "vo_1",
      reason: "x",
      adminNote: "note",
    });
    expect(r.ok).toBe(false);
  });

  it("parses linkedOrderIssueId when provided", () => {
    const r = parseAdminRefundRequestBody({
      scope: "full_order",
      reason: "issue follow-up",
      linkedOrderIssueId: "iss_abc",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.linkedOrderIssueId).toBe("iss_abc");
    }
  });

  it("parses line_item_refund valid body", () => {
    const r = parseAdminRefundRequestBody({
      scope: "line_item_refund",
      vendorOrderId: "vo_1",
      orderLineItemId: "li_1",
      quantity: 1,
      reason: "wrong item",
      adminNote: "internal",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.scope).toBe("line_item_refund");
      expect(r.data.orderLineItemId).toBe("li_1");
      expect(r.data.quantity).toBe(1);
      expect(r.data.includeTax).toBe(true);
    }
  });

  it("rejects line_item_refund missing vendorOrderId", () => {
    const r = parseAdminRefundRequestBody({
      scope: "line_item_refund",
      orderLineItemId: "li_1",
      quantity: 1,
      reason: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects line_item_refund missing orderLineItemId", () => {
    const r = parseAdminRefundRequestBody({
      scope: "line_item_refund",
      vendorOrderId: "vo_1",
      quantity: 1,
      reason: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid quantity", () => {
    const r = parseAdminRefundRequestBody({
      scope: "line_item_refund",
      vendorOrderId: "vo_1",
      orderLineItemId: "li_1",
      quantity: 0,
      reason: "x",
    });
    expect(r.ok).toBe(false);
  });

  it("parses custom partial with platformAbsorbsRefund", () => {
    const r = parseAdminRefundRequestBody({
      scope: "custom_vendor_partial",
      vendorOrderId: "vo_1",
      amountCents: 500,
      reason: "goodwill",
      adminNote: "platform absorbing",
      platformAbsorbsRefund: true,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.platformAbsorbsRefund).toBe(true);
      expect(r.data.amountCents).toBe(500);
    }
  });
});
