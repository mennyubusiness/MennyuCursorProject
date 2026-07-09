import type { SquareOrderSubmitAudit } from "@/lib/integrations/square/square-order.types";
import type { SquareOrderTotalComparison } from "@/lib/integrations/square/square-order-total-comparison";

export type SquareOrderAuditView = {
  squarePaymentId: string | null;
  squareOrderState: string | null;
  squarePaymentStatus: string | null;
  squareLastAttemptAt: string | null;
  reconciliation: SquareOrderTotalComparison | null;
  mappingIssues: unknown;
};

export function extractSquareOrderIdFromAudit(
  squareOrderId: string | null | undefined,
  lastSquareResponse: unknown
): string | null {
  const direct = squareOrderId?.trim();
  if (direct) return direct;

  if (lastSquareResponse == null || typeof lastSquareResponse !== "object") return null;
  const response = lastSquareResponse as {
    createOrder?: { order?: { id?: string } };
  };
  return response.createOrder?.order?.id?.trim() ?? null;
}

export function parseSquareOrderAudit(payload: unknown): SquareOrderAuditView {
  const audit =
    payload != null && typeof payload === "object" ? (payload as SquareOrderSubmitAudit) : null;

  return {
    squarePaymentId: audit?.squarePaymentId?.trim() ?? null,
    squareOrderState: audit?.squareOrderState?.trim() ?? null,
    squarePaymentStatus: audit?.squarePaymentStatus?.trim() ?? null,
    squareLastAttemptAt: audit?.squareLastAttemptAt ?? null,
    reconciliation: audit?.reconciliation ?? null,
    mappingIssues:
      audit != null && "mappingIssues" in audit
        ? (audit as { mappingIssues?: unknown }).mappingIssues ?? null
        : null,
  };
}

export function squareRoutingFailureGuidance(input: {
  error: string | null | undefined;
  squareRoutingLive: boolean;
  hasMappingIssues: boolean;
}): string | null {
  const error = input.error?.trim() ?? "";
  if (!error) return null;

  if (/SQUARE_ROUTING_LIVE/i.test(error) || !input.squareRoutingLive) {
    return "Square routing is selected, but live Square API routing is disabled globally.";
  }

  if (
    /ORDERS_WRITE|PAYMENTS_WRITE|Reconnect Square and approve/i.test(error) ||
    /insufficient permissions/i.test(error)
  ) {
    return "Square permissions are missing. Reconnect Square and approve ORDERS_WRITE/PAYMENTS_WRITE.";
  }

  if (input.hasMappingIssues || /mapping/i.test(error)) {
    return "Square mapping is missing for one or more ordered items/modifiers. Re-import and publish the Square menu or repair mappings before retrying.";
  }

  return null;
}
