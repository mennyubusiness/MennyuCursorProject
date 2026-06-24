import { describe, expect, it } from "vitest";
import {
  buildVendorPayoutTransferGroup,
  buildVendorPayoutTransferStripeMetadata,
} from "./vendor-payout-transfer-stripe-metadata";

describe("vendor payout transfer Stripe metadata", () => {
  it("includes Open Order and legacy metadata keys", () => {
    const meta = buildVendorPayoutTransferStripeMetadata({
      id: "vpt_1",
      paymentAllocationId: "pa_1",
      paymentId: "pay_1",
      orderId: "ord_1",
      vendorOrderId: "vo_1",
      vendorId: "v_1",
    });
    expect(meta.openOrderVendorPayoutTransferId).toBe("vpt_1");
    expect(meta.paymentAllocationId).toBe("pa_1");
    expect(meta.paymentId).toBe("pay_1");
    expect(meta.orderId).toBe("ord_1");
    expect(meta.mennyu_vendor_payout_transfer_id).toBe("vpt_1");
    expect(meta.mennyu_payment_allocation_id).toBe("pa_1");
  });

  it("builds transfer_group from order id", () => {
    expect(buildVendorPayoutTransferGroup("ord_abc")).toBe("order_ord_abc");
  });
});
