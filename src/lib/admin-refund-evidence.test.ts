import { describe, expect, it } from "vitest";
import {
  assessRefundEvidenceForReversalPrep,
  prepareMissingReversalBlockMessage,
} from "./admin-refund-evidence";

describe("assessRefundEvidenceForReversalPrep", () => {
  const base = {
    orderId: "order_1",
    orderTotalCents: 1482,
    denormalizedOrderRefundedCents: 1482,
    ledgerRefundedCents: 0,
    legacyRefundedCents: 0,
    vendorOrderId: "vo_1",
    vendorOrderTotalCents: 1400,
    orderRefunds: [] as const,
    legacyAttempts: [] as const,
  };

  it("flags inconsistent ledger when denormalized refund exists without rows", () => {
    const a = assessRefundEvidenceForReversalPrep({ ...base });
    expect(a.inconsistentLedger).toBe(true);
    expect(a.denormalizedOnlyRefund).toBe(true);
    expect(a.hasSafeFullScopeSucceededRefund).toBe(false);
    expect(a.prepareBlockReason).toBe("refund_is_legacy_or_denormalized_only");
  });

  it("allows safe prepare when succeeded full-order ledger row is linked", () => {
    const a = assessRefundEvidenceForReversalPrep({
      ...base,
      denormalizedOrderRefundedCents: 1482,
      ledgerRefundedCents: 1482,
      orderRefunds: [
        {
          id: "or_1",
          vendorOrderId: null,
          amountCents: 1482,
          status: "succeeded",
          refundScope: "full_order",
          refundAttemptId: "ra_1",
          refundAttemptStatus: "succeeded",
        },
      ],
    });
    expect(a.hasSafeFullScopeSucceededRefund).toBe(true);
    expect(a.prepareBlockReason).toBeNull();
  });

  it("blocks prepare when ledger row exists without succeeded refund attempt", () => {
    const a = assessRefundEvidenceForReversalPrep({
      ...base,
      ledgerRefundedCents: 1482,
      orderRefunds: [
        {
          id: "or_1",
          vendorOrderId: null,
          amountCents: 1482,
          status: "succeeded",
          refundScope: "full_order",
          refundAttemptId: null,
          refundAttemptStatus: null,
        },
      ],
    });
    expect(a.prepareBlockReason).toBe("missing_safe_refund_link");
  });
});

describe("prepareMissingReversalBlockMessage", () => {
  it("returns actionable copy for missing safe refund link", () => {
    expect(prepareMissingReversalBlockMessage("refund_ledger_missing")).toMatch(
      /cannot prepare the reversal automatically/
    );
    expect(prepareMissingReversalBlockMessage("refund_is_legacy_or_denormalized_only")).toMatch(
      /no matching refund ledger row/
    );
  });
});
