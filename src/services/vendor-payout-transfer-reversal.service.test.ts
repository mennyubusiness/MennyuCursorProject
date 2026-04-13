import { describe, expect, it } from "vitest";
import {
  getVendorTransferReversalAmountCents,
  stableTransferReversalIdempotencyKey,
} from "./vendor-payout-transfer-reversal.service";
import { VENDOR_PAYOUT_TRANSFER_STATUS } from "./vendor-payout-transfer.service";

describe("vendor payout transfer reversal helpers", () => {
  it("stable idempotency key is deterministic", () => {
    expect(stableTransferReversalIdempotencyKey("ra_1", "vpt_2")).toBe("mennyu_vptr_ra_1_vpt_2");
  });

  it("reversal amount is zero unless transfer is paid with positive amount", () => {
    expect(
      getVendorTransferReversalAmountCents({
        amountCents: 1000,
        status: VENDOR_PAYOUT_TRANSFER_STATUS.pending,
      })
    ).toBe(0);
    expect(
      getVendorTransferReversalAmountCents({
        amountCents: 0,
        status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
      })
    ).toBe(0);
    expect(
      getVendorTransferReversalAmountCents({
        amountCents: 1500,
        status: VENDOR_PAYOUT_TRANSFER_STATUS.paid,
      })
    ).toBe(1500);
  });
});
