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
