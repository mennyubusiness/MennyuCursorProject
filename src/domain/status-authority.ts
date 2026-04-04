/**
 * Status authority model: who is the preferred source of truth for a vendor order,
 * and what last produced a status change. Used for precedence (e.g. block vendor dashboard
 * updates on POS-managed orders unless fallback is enabled).
 * @see docs/STATUS_AUTHORITY_DESIGN.md
 */

export type VendorOrderStatusAuthority =
  | "pos"
  | "dma"
  | "vendor_manual"
  | "admin_override";

export type VendorOrderStatusSource =
  | "deliverect_webhook"
  | "deliverect_fallback"
  | "dma_action"
  | "vendor_dashboard"
  | "admin_action"
  | "system";

export const VENDOR_ORDER_STATUS_AUTHORITIES: VendorOrderStatusAuthority[] = [
  "pos",
  "dma",
  "vendor_manual",
  "admin_override",
];

export const VENDOR_ORDER_STATUS_SOURCES: VendorOrderStatusSource[] = [
  "deliverect_webhook",
  "deliverect_fallback",
  "dma_action",
  "vendor_dashboard",
  "admin_action",
  "system",
];

/** Result of precedence check: allow the update or block with a reason for UI. */
export type StatusUpdatePrecedenceResult =
  | { allowed: true }
  | { allowed: false; reason: "POS_MANAGED_USE_FALLBACK" | "UNKNOWN" };

export interface VendorOrderAuthoritySnapshot {
  statusAuthority: VendorOrderStatusAuthority | null;
  lastStatusSource: VendorOrderStatusSource | null;
  deliverectChannelLinkId?: string | null;
  vendor?: { deliverectChannelLinkId?: string | null } | null;
  routingStatus: string;
  manuallyRecoveredAt?: Date | string | null;
}

/**
 * Infer authority for legacy vendor orders that have no statusAuthority set.
 * Used when reading VO and authority is null.
 *
 * Deliverect: `routingStatus === "sent"` means submitted to POS but webhook/sync is not
 * proven yet — treat as vendor_manual for precedence until explicit `pos` is stored
 * (first processed webhook promotes in applyDeliverectStatusWebhook).
 */
export function inferLegacyAuthority(
  vo: VendorOrderAuthoritySnapshot
): VendorOrderStatusAuthority {
  if (vo.manuallyRecoveredAt != null) return "admin_override";
  const channelLinkId =
    vo.deliverectChannelLinkId ?? vo.vendor?.deliverectChannelLinkId;
  if (channelLinkId != null && String(channelLinkId).trim() !== "") {
    if (vo.routingStatus === "sent") {
      return "vendor_manual";
    }
    return "pos";
  }
  return "vendor_manual";
}

/**
 * Resolve effective authority: use stored value or infer for legacy rows.
 */
export function getEffectiveAuthority(
  vo: VendorOrderAuthoritySnapshot
): VendorOrderStatusAuthority {
  if (
    vo.statusAuthority != null &&
    VENDOR_ORDER_STATUS_AUTHORITIES.includes(vo.statusAuthority)
  ) {
    return vo.statusAuthority;
  }
  return inferLegacyAuthority(vo);
}

/**
 * Precedence: whether an incoming status update from the given source should be applied.
 * POS-managed orders: allow deliverect_webhook and system; block vendor_dashboard/dma_action
 * unless authority is admin_override.
 */
export function shouldApplyStatusUpdate(
  vo: VendorOrderAuthoritySnapshot,
  source: VendorOrderStatusSource
): StatusUpdatePrecedenceResult {
  const authority = getEffectiveAuthority(vo);

  if (source === "admin_action") return { allowed: true };
  if (authority === "admin_override") return { allowed: true };

  if (authority === "pos") {
    if (source === "deliverect_webhook" || source === "deliverect_fallback" || source === "system")
      return { allowed: true };
    if (source === "vendor_dashboard" || source === "dma_action") {
      return { allowed: false, reason: "POS_MANAGED_USE_FALLBACK" };
    }
  }

  if (authority === "dma" || authority === "vendor_manual") {
    return { allowed: true };
  }

  return { allowed: true };
}
