/**
 * Canonical admin action matrix: what actions to show for a vendor order based on its state.
 * Drives consistent UI across Overview, Exceptions, and Orders. Reuses exception and transition helpers.
 */
import { getExceptionType, type ExceptionType } from "@/lib/admin-exceptions";
import { getAllowedProgressionTargets } from "@/domain/vendor-order-transition";
import type { VendorOrderRoutingStatus, VendorOrderFulfillmentStatus } from "@/domain/types";

export type AdminVOContext =
  | ExceptionType
  | "manually_recovered"
  | "healthy_in_progress"
  | "terminal";

export interface AdminActionState {
  context: AdminVOContext;
  exceptionType: ExceptionType | null;
  showExceptionActions: boolean;
  showRetry: boolean;
  showManualRecovery: boolean;
  showCancel: boolean;
  showProgression: boolean;
  allowedProgressionTargets: string[];
  hasAnyExceptionAction: boolean;
  hasAnyProgressionAction: boolean;
}

export interface VOForAdminActions {
  routingStatus: string;
  fulfillmentStatus: string;
  createdAt: Date;
  deliverectAttempts?: number | null;
  deliverectSubmittedAt?: Date | null;
  deliverectLastError?: string | null;
}

const TERMINAL_FULFILLMENT = new Set<string>(["completed", "cancelled"]);

/**
 * Returns the admin action state for a vendor order. Use this to drive exception vs progression UI.
 */
export function getAdminActionState(
  vo: VOForAdminActions,
  routingAvailable: boolean
): AdminActionState {
  const exceptionType = getExceptionType(vo);
  const routing = vo.routingStatus as VendorOrderRoutingStatus;
  const fulfillment = vo.fulfillmentStatus as VendorOrderFulfillmentStatus;
  const allowedProgressionTargets = getAllowedProgressionTargets(routing, fulfillment);
  const isTerminal = TERMINAL_FULFILLMENT.has(vo.fulfillmentStatus);

  if (exceptionType === "routing_failed" || exceptionType === "routing_stuck") {
    const showRetry =
      (exceptionType === "routing_failed" || exceptionType === "routing_stuck") && routingAvailable;
    const showManualRecovery =
      (exceptionType === "routing_failed" || exceptionType === "routing_stuck") &&
      vo.fulfillmentStatus === "pending";
    const showCancel =
      vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed";
    const hasAnyExceptionAction = showRetry || showManualRecovery || showCancel;
    return {
      context: exceptionType,
      exceptionType,
      showExceptionActions: true,
      showRetry,
      showManualRecovery,
      showCancel,
      showProgression: allowedProgressionTargets.length > 0,
      allowedProgressionTargets,
      hasAnyExceptionAction,
      hasAnyProgressionAction: allowedProgressionTargets.length > 0,
    };
  }

  if (
    (vo.routingStatus === "failed" || vo.routingStatus === "pending") &&
    vo.fulfillmentStatus !== "pending"
  ) {
    return {
      context: "manually_recovered",
      exceptionType: null,
      showExceptionActions: true,
      showRetry: false,
      showManualRecovery: false,
      showCancel: vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed",
      showProgression: allowedProgressionTargets.length > 0,
      allowedProgressionTargets,
      hasAnyExceptionAction: vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed",
      hasAnyProgressionAction: allowedProgressionTargets.length > 0,
    };
  }

  if (isTerminal) {
    return {
      context: "terminal",
      exceptionType: null,
      showExceptionActions: false,
      showRetry: false,
      showManualRecovery: false,
      showCancel: false,
      showProgression: false,
      allowedProgressionTargets: [],
      hasAnyExceptionAction: false,
      hasAnyProgressionAction: false,
    };
  }

  return {
    context: "healthy_in_progress",
    exceptionType: null,
    showExceptionActions: false,
    showRetry: false,
    showManualRecovery: false,
    showCancel: vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed",
    showProgression: allowedProgressionTargets.length > 0,
    allowedProgressionTargets,
    hasAnyExceptionAction: false,
    hasAnyProgressionAction: allowedProgressionTargets.length > 0,
  };
}
