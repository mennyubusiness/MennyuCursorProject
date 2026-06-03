import { describe, expect, it } from "vitest";
import {
  canDismissStaleRefundAttempt,
  isRealInFlightRefundAttempt,
  isStaleBlockingRefundAttempt,
  STALE_REFUND_ATTEMPT_GRACE_MS,
} from "./stale-refund-attempt";

const baseAttempt = {
  id: "ra_1",
  amountCents: 2408,
  stripeRefundId: null as string | null,
  dismissedAsLegacyAt: null as Date | null,
  hasLinkedOrderRefund: false,
  idempotencyKey: "admin:full_order:ord_1:_:2408",
  failureCode: null as string | null,
  failureMessage: null as string | null,
  createdAt: new Date(Date.now() - STALE_REFUND_ATTEMPT_GRACE_MS - 1000),
};

describe("stale-refund-attempt domain", () => {
  it("orphaned attempted RefundAttempt is stale blocking", () => {
    expect(
      isStaleBlockingRefundAttempt({ ...baseAttempt, status: "attempted" }, [])
    ).toBe(true);
    expect(
      isRealInFlightRefundAttempt({ ...baseAttempt, status: "attempted" }, [])
    ).toBe(false);
  });

  it("failed RefundAttempt without ledger does not block", () => {
    expect(
      isStaleBlockingRefundAttempt({ ...baseAttempt, status: "failed" }, [])
    ).toBe(false);
  });

  it("attempted with stripeRefundId is real in-flight, not stale", () => {
    expect(
      isStaleBlockingRefundAttempt(
        { ...baseAttempt, status: "attempted", stripeRefundId: "re_1" },
        []
      )
    ).toBe(false);
    expect(
      isRealInFlightRefundAttempt(
        { ...baseAttempt, status: "attempted", stripeRefundId: "re_1" },
        []
      )
    ).toBe(true);
  });

  it("pending OrderRefund blocks as real in-flight, not stale", () => {
    expect(
      isStaleBlockingRefundAttempt({ ...baseAttempt, status: "attempted" }, [
        { refundAttemptId: "ra_1", status: "pending" },
      ])
    ).toBe(false);
  });

  it("orphaned attempted is dismissible when no stripe refund id", () => {
    expect(
      canDismissStaleRefundAttempt({ ...baseAttempt, status: "attempted" }, [])
    ).toEqual({ ok: true });
  });

  it("succeeded attempt is never dismissible", () => {
    expect(
      canDismissStaleRefundAttempt({ ...baseAttempt, status: "succeeded" }, [])
    ).toEqual({ ok: false, reason: "succeeded_not_dismissible" });
  });

  it("attempt with stripeRefundId is not dismissible", () => {
    expect(
      canDismissStaleRefundAttempt(
        { ...baseAttempt, status: "attempted", stripeRefundId: "re_1" },
        []
      )
    ).toEqual({ ok: false, reason: "has_stripe_refund_id" });
  });

  it("dismissed attempt is ignored", () => {
    expect(
      isStaleBlockingRefundAttempt(
        { ...baseAttempt, status: "attempted", dismissedAsLegacyAt: new Date() },
        []
      )
    ).toBe(false);
  });
});
