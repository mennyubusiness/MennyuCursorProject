/**
 * Customer-facing refund status (no transfer reversal / platform internals).
 */

export type CustomerRefundSnapshot = {
  status: string;
  amountCents: number;
  createdAt: Date;
  source: "ledger" | "legacy_attempt";
};

export function pickLatestCustomerRefundDisplay(input: {
  orderRefunds?: Array<{ status: string; amountCents: number; createdAt: Date }>;
  refundAttempts?: Array<{ status: string; amountCents: number; createdAt: Date }>;
}): CustomerRefundSnapshot | null {
  const ledger = (input.orderRefunds ?? []).map((r) => ({
    status: r.status,
    amountCents: r.amountCents,
    createdAt: r.createdAt,
    source: "ledger" as const,
  }));
  const legacy = (input.refundAttempts ?? []).map((r) => ({
    status: r.status,
    amountCents: r.amountCents,
    createdAt: r.createdAt,
    source: "legacy_attempt" as const,
  }));
  const all = [...ledger, ...legacy].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
  return all[0] ?? null;
}

export function customerRefundDisplayMessage(
  latest: CustomerRefundSnapshot | null
): { line: string; timelineLabel?: string } | null {
  if (!latest) return null;
  const amountFormatted = `$${(latest.amountCents / 100).toFixed(2)}`;

  if (latest.status === "succeeded") {
    return {
      line: `Refunded. Refund of ${amountFormatted} issued.`,
      timelineLabel: `Refund of ${amountFormatted} issued`,
    };
  }
  if (latest.status === "pending" || latest.status === "requires_action") {
    return { line: "Refund pending.", timelineLabel: undefined };
  }
  if (latest.status === "failed") {
    return {
      line: "Refund issue — our team is reviewing this.",
      timelineLabel: undefined,
    };
  }
  if (latest.status === "attempted") {
    return { line: "Refund pending.", timelineLabel: undefined };
  }
  return null;
}

export function isPartialRefundDisplay(input: {
  orderTotalCents: number;
  refundedCents: number;
}): boolean {
  return input.refundedCents > 0 && input.refundedCents < input.orderTotalCents;
}
