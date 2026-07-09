import type {
  SquareOrderSubmitAudit,
  SquareWebhookLastApplyRecord,
} from "@/lib/integrations/square/square-order.types";
import type { SquareOrderTotalComparison } from "@/lib/integrations/square/square-order-total-comparison";
import { isSquareStatusSyncConfigured } from "@/services/square-status-sync.service";

export type SquareOrderAuditView = {
  squarePaymentId: string | null;
  squareOrderState: string | null;
  squarePaymentStatus: string | null;
  squareLastAttemptAt: string | null;
  reconciliation: SquareOrderTotalComparison | null;
  mappingIssues: unknown;
  statusSync: SquareWebhookLastApplyRecord | null;
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
    statusSync: audit?.statusSync ?? null,
  };
}

export function squareStatusSyncAdminSummary(input: {
  statusSyncConfigured: boolean;
  audit: SquareOrderAuditView;
  lastExternalStatus: string | null;
  lastExternalStatusAt: Date | string | null;
}): {
  configuredLabel: string;
  lastSyncedAt: string | null;
  lastFulfillmentState: string | null;
  lastOrderState: string | null;
  lastError: string | null;
} {
  const sync = input.audit.statusSync;
  return {
    configuredLabel: input.statusSyncConfigured ? "Yes" : "No — set SQUARE_WEBHOOK_SIGNATURE_KEY",
    lastSyncedAt: sync?.processedAt ?? (input.lastExternalStatusAt ? String(input.lastExternalStatusAt) : null),
    lastFulfillmentState: sync?.squareFulfillmentState ?? null,
    lastOrderState: sync?.squareOrderState ?? input.audit.squareOrderState,
    lastError: sync?.lastError ?? (sync?.outcome === "fetch_failed" ? sync.detail ?? null : null),
  };
}

export function isSquareStatusSyncConfiguredForAdmin(): boolean {
  return isSquareStatusSyncConfigured();
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
