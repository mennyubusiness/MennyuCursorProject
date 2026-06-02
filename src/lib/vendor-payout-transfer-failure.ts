/**
 * Normalize vendor payout transfer failure reasons for admin display.
 */

export const INSUFFICIENT_BALANCE_STATUS = "blocked_insufficient_balance" as const;
export const INSUFFICIENT_BALANCE_BLOCKED_REASON = "insufficient_stripe_available_balance" as const;
export const INSUFFICIENT_BALANCE_DISPLAY = "Insufficient Stripe available balance";
export const INSUFFICIENT_BALANCE_DETAIL =
  "Funds may still be pending or may have been paid out automatically before this transfer was retried.";

export function isStripeInsufficientFundsError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const o = error as { code?: string; type?: string; message?: string };
    if (o.code === "balance_insufficient") return true;
    if (typeof o.message === "string" && isInsufficientFundsMessage(o.message)) return true;
  }
  if (error instanceof Error && isInsufficientFundsMessage(error.message)) return true;
  return false;
}

export function isInsufficientFundsMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return /insufficient available funds/i.test(message);
}

export function isInsufficientBalanceTransfer(row: {
  status: string;
  blockedReason?: string | null;
  failureMessage?: string | null;
}): boolean {
  if (row.status === INSUFFICIENT_BALANCE_STATUS) return true;
  if (row.blockedReason === INSUFFICIENT_BALANCE_BLOCKED_REASON) return true;
  return row.status === "failed" && isInsufficientFundsMessage(row.failureMessage);
}

export function displayPayoutTransferFailure(row: {
  status: string;
  blockedReason?: string | null;
  failureMessage?: string | null;
}): { primary: string; detail: string | null; raw: string | null } {
  if (row.status === "blocked" && row.blockedReason) {
    return { primary: row.blockedReason, detail: null, raw: row.failureMessage ?? null };
  }
  if (isInsufficientBalanceTransfer(row)) {
    return {
      primary: INSUFFICIENT_BALANCE_DISPLAY,
      detail: INSUFFICIENT_BALANCE_DETAIL,
      raw: row.failureMessage?.trim() ? row.failureMessage : null,
    };
  }
  if (row.failureMessage?.trim()) {
    return { primary: row.failureMessage.trim(), detail: null, raw: null };
  }
  return { primary: "—", detail: null, raw: null };
}

export function isRetryablePayoutTransfer(row: {
  status: string;
  stripeTransferId?: string | null;
  destinationAccountId: string;
}): boolean {
  if (row.stripeTransferId?.trim() && row.status === "paid") return false;
  if (row.stripeTransferId?.trim() && row.status !== "paid") return false;
  if (row.destinationAccountId === "blocked") return false;
  return row.status === "failed" || row.status === INSUFFICIENT_BALANCE_STATUS;
}
