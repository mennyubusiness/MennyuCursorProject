/**
 * Normalize vendor payout transfer failure reasons for admin display.
 */

export const INSUFFICIENT_BALANCE_STATUS = "blocked_insufficient_balance" as const;
export const INSUFFICIENT_BALANCE_BLOCKED_REASON = "insufficient_stripe_available_balance" as const;
export const INSUFFICIENT_BALANCE_DISPLAY =
  "Vendor transfer blocked: insufficient Stripe available balance";
export const INSUFFICIENT_BALANCE_DETAIL =
  "Customer payment may exist, but no vendor Connect transfer was sent. This vendor is still owed. Funds may be pending in Stripe or may have been included in a platform payout to the Open Order bank.";

export const IDEMPOTENCY_MISMATCH_STATUS = "blocked_idempotency_mismatch" as const;
export const IDEMPOTENCY_MISMATCH_BLOCKED_REASON = "idempotency_parameter_mismatch" as const;
export const IDEMPOTENCY_MISMATCH_DISPLAY =
  "Stripe rejected this retry because the original idempotency key was previously used with different transfer parameters. Reconcile with Stripe before retrying with a new key.";
export const IDEMPOTENCY_MISMATCH_DETAIL =
  "Stripe remembers this idempotency key with different transfer parameters. Check Stripe before retrying.";

export function isIdempotencyMismatchMessage(message: string | null | undefined): boolean {
  if (!message?.trim()) return false;
  return /Keys for idempotent requests can only be used with the same parameters/i.test(message);
}

export function isStripeIdempotencyParameterMismatchError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const o = error as { type?: string; code?: string; message?: string };
    if (o.type === "idempotency_error") return true;
    if (typeof o.message === "string" && isIdempotencyMismatchMessage(o.message)) return true;
  }
  if (error instanceof Error && isIdempotencyMismatchMessage(error.message)) return true;
  return false;
}

export function isIdempotencyMismatchTransfer(row: {
  status: string;
  blockedReason?: string | null;
  failureMessage?: string | null;
}): boolean {
  if (row.status === IDEMPOTENCY_MISMATCH_STATUS) return true;
  if (row.blockedReason === IDEMPOTENCY_MISMATCH_BLOCKED_REASON) return true;
  return row.status === "failed" && isIdempotencyMismatchMessage(row.failureMessage);
}

export function canRetryWithNewIdempotencyKey(
  row: {
    status: string;
    stripeTransferId?: string | null;
    destinationAccountId: string;
  },
  lastReconciliationOutcome?: string | null
): boolean {
  if (!isIdempotencyMismatchTransfer(row)) return false;
  if (row.stripeTransferId?.trim()) return false;
  if (row.destinationAccountId === "blocked") return false;
  return lastReconciliationOutcome === "unchanged_not_found";
}

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
  if (isIdempotencyMismatchTransfer(row)) {
    return {
      primary: IDEMPOTENCY_MISMATCH_DISPLAY,
      detail: IDEMPOTENCY_MISMATCH_DETAIL,
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
  if (isIdempotencyMismatchTransfer(row)) return false;
  return row.status === "failed" || row.status === INSUFFICIENT_BALANCE_STATUS;
}
