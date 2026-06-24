import { describe, expect, it } from "vitest";
import {
  buildPodPayoutTransferGroup,
  buildPodPayoutTransferStripeMetadata,
} from "@/lib/pod-payout-transfer-stripe-metadata";

describe("pod payout transfer Stripe metadata", () => {
  it("includes open order and legacy keys", () => {
    const metadata = buildPodPayoutTransferStripeMetadata({
      id: "ppt_1",
      podPayoutAllocationId: "ppa_1",
      podId: "pod_1",
      orderId: "ord_1",
      paymentId: "pay_1",
      recipientUserId: "user_1",
    });
    expect(metadata.openOrderPodPayoutTransferId).toBe("ppt_1");
    expect(metadata.podPayoutAllocationId).toBe("ppa_1");
    expect(metadata.openOrderPurpose).toBe("pod_payout");
    expect(metadata.mennyu_pod_payout_transfer_id).toBe("ppt_1");
    expect(metadata.recipientUserId).toBe("user_1");
  });

  it("uses order transfer group", () => {
    expect(buildPodPayoutTransferGroup("ord_abc")).toBe("order_ord_abc");
  });
});
