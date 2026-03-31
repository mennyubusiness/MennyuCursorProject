import { describe, expect, it } from "vitest";
import { assertPaymentPayoutSnapshotMatchesLiveFee } from "./payment-payout-snapshot";

describe("assertPaymentPayoutSnapshotMatchesLiveFee", () => {
  it("accepts matching stored and live fee (both null)", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: null,
          allocations: [{ allocatedProcessingFeeCents: 0 }],
        },
        null
      )
    ).not.toThrow();
  });

  it("accepts matching stored and live fee (same integer)", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: 42,
          allocations: [{ allocatedProcessingFeeCents: 10 }, { allocatedProcessingFeeCents: 32 }],
        },
        42
      )
    ).not.toThrow();
  });

  it("throws on stripe fee mismatch (idempotency guard)", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: 40,
          allocations: [{ allocatedProcessingFeeCents: 40 }],
        },
        41
      )
    ).toThrow(/PAYMENT_STRIPE_FEE_MISMATCH/);
  });

  it("allows legacy snapshot: stored null, live fee set, zero allocated (historical row)", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: null,
          allocations: [{ allocatedProcessingFeeCents: 0 }, { allocatedProcessingFeeCents: 0 }],
        },
        99
      )
    ).not.toThrow();
  });

  it("throws when stored fee null but allocations sum to a positive fee (inconsistent snapshot)", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: null,
          allocations: [{ allocatedProcessingFeeCents: 40 }, { allocatedProcessingFeeCents: 10 }],
        },
        50
      )
    ).toThrow(/PAYMENT_ALLOCATED_SUM_MISMATCH/);
  });

  it("throws when sum allocated does not equal stored fee", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: 100,
          allocations: [{ allocatedProcessingFeeCents: 40 }, { allocatedProcessingFeeCents: 50 }],
        },
        100
      )
    ).toThrow(/PAYMENT_ALLOCATED_SUM_MISMATCH/);
  });

  it("requires sum allocated zero when stored fee null", () => {
    expect(() =>
      assertPaymentPayoutSnapshotMatchesLiveFee(
        {
          id: "p1",
          stripeProcessingFeeCents: null,
          allocations: [{ allocatedProcessingFeeCents: 5 }],
        },
        null
      )
    ).toThrow(/PAYMENT_ALLOCATED_SUM_MISMATCH/);
  });
});
