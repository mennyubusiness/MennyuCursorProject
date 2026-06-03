import { describe, expect, it } from "vitest";
import {
  displayPayoutTransferFailure,
  INSUFFICIENT_BALANCE_DISPLAY,
  isInsufficientBalanceTransfer,
  isInsufficientFundsMessage,
  isIdempotencyMismatchTransfer,
  isRetryablePayoutTransfer,
  isStripeInsufficientFundsError,
} from "./vendor-payout-transfer-failure";

describe("vendor-payout-transfer-failure", () => {
  it("detects Stripe insufficient funds errors", () => {
    expect(isStripeInsufficientFundsError({ code: "balance_insufficient" })).toBe(true);
    expect(
      isInsufficientFundsMessage(
        "You have insufficient available funds in your Stripe account. Try adding funds..."
      )
    ).toBe(true);
  });

  it("normalizes legacy failed rows with insufficient funds message", () => {
    const row = {
      status: "failed",
      failureMessage:
        "You have insufficient available funds in your Stripe account. Try adding funds directly to your available balance by creating Charges using the 4000000000000077 test card.",
    };
    expect(isInsufficientBalanceTransfer(row)).toBe(true);
    const display = displayPayoutTransferFailure(row);
    expect(display.primary).toBe(INSUFFICIENT_BALANCE_DISPLAY);
    expect(display.raw).toContain("insufficient available funds");
  });

  it("blocks retry for paid transfers", () => {
    expect(
      isRetryablePayoutTransfer({
        status: "paid",
        stripeTransferId: "tr_123",
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
  });

  it("allows retry for blocked insufficient balance without stripe transfer id", () => {
    expect(
      isRetryablePayoutTransfer({
        status: "blocked_insufficient_balance",
        stripeTransferId: null,
        destinationAccountId: "acct_1",
      })
    ).toBe(true);
  });

  it("blocks retry when stripe transfer id exists but status is not paid", () => {
    expect(
      isRetryablePayoutTransfer({
        status: "failed",
        stripeTransferId: "tr_123",
        destinationAccountId: "acct_1",
      })
    ).toBe(false);
  });

  it("detects idempotency mismatch messages", () => {
    const row = {
      status: "failed",
      failureMessage:
        "Keys for idempotent requests can only be used with the same parameters they were first used with.",
    };
    expect(isIdempotencyMismatchTransfer(row)).toBe(true);
    expect(isRetryablePayoutTransfer({ ...row, stripeTransferId: null, destinationAccountId: "acct_1" })).toBe(
      false
    );
  });
});
