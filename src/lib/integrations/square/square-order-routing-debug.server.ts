import "server-only";

import { env } from "@/lib/env";
import { assertSquareOrderRoutingReady } from "@/lib/integrations/square/square-order-routing-readiness";
import {
  extractSquareOrderIdFromAudit,
  parseSquareOrderAudit,
} from "@/lib/integrations/square/square-order-audit";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import {
  canRetryRouting,
  isSquarePermissionsRetryBlocked,
  type VendorOrderRecoverySnapshot,
} from "@/lib/admin-needs-attention-actions";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export type SquareOrderRoutingDebug = {
  vendorOrderId: string;
  orderRoutingMode: string;
  routingStatus: string;
  squareRoutingLive: boolean;
  routingRetryAvailable: boolean;
  squareOrderId: string | null;
  squarePaymentId: string | null;
  squarePaymentStatus: string | null;
  squareSubmittedAt: string | null;
  squareLastAttemptAt: string | null;
  squareAttempts: number;
  squareLastError: string | null;
  totalComparison: ReturnType<typeof parseSquareOrderAudit>["reconciliation"];
  retryEligible: boolean;
  retryBlockedReason: string | null;
  connectionHealthy: boolean;
  missingRequirements: string[];
  failureGuidance: string | null;
};

export async function loadSquareOrderRoutingDebug(input: {
  vendorOrderId: string;
  vendorId: string;
  orderRoutingMode: string;
  routingStatus: string;
  squareOrderId: string | null;
  squareSubmittedAt: Date | null;
  squareAttempts: number;
  squareLastError: string | null;
  lastSquarePayload: unknown;
  lastSquareResponse: unknown;
  orderStatus: string;
  fulfillmentStatus: string;
  manuallyRecoveredAt: Date | null;
}): Promise<SquareOrderRoutingDebug | null> {
  if (!isSquareRoutingMode(input.orderRoutingMode)) return null;

  const audit = parseSquareOrderAudit(input.lastSquarePayload);
  const squareOrderId = extractSquareOrderIdFromAudit(input.squareOrderId, input.lastSquareResponse);
  const readiness = await assertSquareOrderRoutingReady(input.vendorId);

  const voSnapshot: VendorOrderRecoverySnapshot = {
    routingStatus: input.routingStatus,
    fulfillmentStatus: input.fulfillmentStatus,
    squareOrderId,
    manuallyRecoveredAt: input.manuallyRecoveredAt,
    squareLastError: input.squareLastError,
  };

  const retryEligible = canRetryRouting(voSnapshot, { status: input.orderStatus }, input.orderRoutingMode);
  let retryBlockedReason: string | null = null;
  if (!retryEligible) {
    if (isSquarePermissionsRetryBlocked(input.squareLastError, input.orderRoutingMode)) {
      retryBlockedReason = "Square permissions missing — reconnect Square before retrying.";
    } else if (!isRoutingRetryAvailable()) {
      retryBlockedReason = "Square live routing is disabled globally (SQUARE_ROUTING_LIVE is not true).";
    } else if (input.routingStatus === "sent" && squareOrderId) {
      retryBlockedReason = "Square order already submitted.";
    } else if (!readiness.ok) {
      retryBlockedReason = readiness.error;
    } else {
      retryBlockedReason = "Retry is not available for this order state.";
    }
  }

  const { squareRoutingFailureGuidance } = await import("@/lib/integrations/square/square-order-audit");

  return {
    vendorOrderId: input.vendorOrderId,
    orderRoutingMode: input.orderRoutingMode,
    routingStatus: input.routingStatus,
    squareRoutingLive: env.SQUARE_ROUTING_LIVE === "true",
    routingRetryAvailable: isRoutingRetryAvailable(),
    squareOrderId,
    squarePaymentId: audit.squarePaymentId,
    squarePaymentStatus: audit.squarePaymentStatus,
    squareSubmittedAt: input.squareSubmittedAt?.toISOString() ?? null,
    squareLastAttemptAt: audit.squareLastAttemptAt,
    squareAttempts: input.squareAttempts,
    squareLastError: input.squareLastError,
    totalComparison: audit.reconciliation,
    retryEligible,
    retryBlockedReason,
    connectionHealthy: readiness.ok,
    missingRequirements: readiness.ok ? [] : [readiness.error],
    failureGuidance: squareRoutingFailureGuidance({
      error: input.squareLastError,
      squareRoutingLive: env.SQUARE_ROUTING_LIVE === "true",
      hasMappingIssues: Boolean(audit.mappingIssues),
    }),
  };
}
