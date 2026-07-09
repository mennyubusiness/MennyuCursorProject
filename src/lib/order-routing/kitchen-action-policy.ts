import type { VendorOrderRoutingMode } from "@prisma/client";

import type { VendorOrderAuthoritySnapshot } from "@/domain/status-authority";
import { getEffectiveAuthority } from "@/domain/status-authority";
import {
  getKitchenManagedOrderBadge,
  getKitchenProviderDisplayName,
  getKitchenRecoveryCopy,
  getKitchenStatusSyncCopy,
  getKitchenVendorLockMessage,
  type KitchenStatusSyncConfigured,
} from "@/lib/integrations/provider-display";
import { hasDeliverectChannelLink } from "@/lib/deliverect-vendor-order-authority";
import {
  isDeliverectRoutingMode,
  isManualDashboardRoutingMode,
  isSquareRoutingMode,
} from "@/lib/vendor-order-routing-mode";

export type KitchenActionProvider = VendorOrderRoutingMode;

export type KitchenActionPolicy = {
  actionsLocked: boolean;
  provider: KitchenActionProvider;
  providerDisplayName: string;
  reason: string | null;
  managedOrderBadge: string | null;
  kitchenLockTooltip: string | null;
  /** true = sync known on; false = known off; null = unknown (do not claim missing). */
  statusSyncAvailable: KitchenStatusSyncConfigured;
  statusSyncCopy: string | null;
  recoveryAllowed: boolean;
  recoveryCopy: string | null;
  /** Show provider-managed banner (not for routing failures before external handoff). */
  showProviderManagedState: boolean;
  routingFailed: boolean;
};

export type KitchenActionPolicyVendorInput = {
  orderRoutingMode: VendorOrderRoutingMode | string | null;
  deliverectChannelLinkId?: string | null;
};

export type KitchenActionPolicyOrderInput = {
  routingStatus: string;
  fulfillmentStatus?: string;
  squareOrderId?: string | null;
  deliverectOrderId?: string | null;
  manuallyRecoveredAt?: Date | string | null;
  statusAuthority?: VendorOrderAuthoritySnapshot["statusAuthority"];
  deliverectChannelLinkId?: string | null;
  vendor?: { deliverectChannelLinkId?: string | null };
};

export type KitchenActionPolicyIntegrationInput = {
  /**
   * Square webhook/status sync readiness.
   * true / false = known; null or omitted = unknown (neutral copy, never “not configured”).
   */
  squareStatusSyncConfigured?: boolean | null;
  /**
   * Deliverect / POS status-sync readiness.
   * true / false = known; null or omitted = unknown.
   */
  deliverectRoutingLive?: boolean | null;
  /** Generic override when provider-specific flags are not set. */
  statusSyncConfigured?: boolean | null;
};

function normalizeProvider(
  orderRoutingMode: VendorOrderRoutingMode | string | null | undefined
): KitchenActionProvider {
  if (orderRoutingMode === "deliverect") return "deliverect";
  if (orderRoutingMode === "square") return "square";
  return "manual_dashboard";
}

function isRoutingFailedWithoutExternalHandoff(order: KitchenActionPolicyOrderInput): boolean {
  if (order.routingStatus !== "failed") return false;
  const hasSquare = Boolean(order.squareOrderId?.trim());
  const hasDeliverect = Boolean(order.deliverectOrderId?.trim());
  return !hasSquare && !hasDeliverect;
}

function isExternallyRoutedOrder(order: KitchenActionPolicyOrderInput): boolean {
  if (order.squareOrderId?.trim()) return true;
  if (order.deliverectOrderId?.trim()) return true;
  if (order.routingStatus === "sent" || order.routingStatus === "confirmed") {
    return true;
  }
  return false;
}

function isSquareExternallyManaged(
  vendor: KitchenActionPolicyVendorInput,
  order: KitchenActionPolicyOrderInput
): boolean {
  if (!isSquareRoutingMode(vendor.orderRoutingMode)) return false;
  if (order.manuallyRecoveredAt != null) return false;
  if (getEffectiveAuthority(order as VendorOrderAuthoritySnapshot) === "admin_override") {
    return false;
  }
  if (isRoutingFailedWithoutExternalHandoff(order)) return false;
  return Boolean(order.squareOrderId?.trim()) || isExternallyRoutedOrder(order);
}

function isDeliverectExternallyManaged(
  vendor: KitchenActionPolicyVendorInput,
  order: KitchenActionPolicyOrderInput
): boolean {
  if (!isDeliverectRoutingMode(vendor.orderRoutingMode)) return false;
  if (order.manuallyRecoveredAt != null) return false;
  if (getEffectiveAuthority(order as VendorOrderAuthoritySnapshot) === "admin_override") {
    return false;
  }
  if (isRoutingFailedWithoutExternalHandoff(order)) return false;
  const channelLinked = hasDeliverectChannelLink({
    deliverectChannelLinkId:
      order.deliverectChannelLinkId ?? vendor.deliverectChannelLinkId,
    vendor: order.vendor ?? { deliverectChannelLinkId: vendor.deliverectChannelLinkId },
  });
  if (!channelLinked) return false;
  return Boolean(order.deliverectOrderId?.trim()) || isExternallyRoutedOrder(order);
}

/**
 * Resolve sync availability: only true/false when explicitly provided.
 * Omitted or null → null (unknown) so UI never claims sync is missing by default.
 */
export function resolveStatusSyncAvailable(
  provider: KitchenActionProvider,
  integration?: KitchenActionPolicyIntegrationInput
): KitchenStatusSyncConfigured {
  if (integration?.statusSyncConfigured !== undefined && integration.statusSyncConfigured !== null) {
    return integration.statusSyncConfigured;
  }
  if (provider === "square") {
    if (
      integration?.squareStatusSyncConfigured === undefined ||
      integration.squareStatusSyncConfigured === null
    ) {
      return null;
    }
    return integration.squareStatusSyncConfigured;
  }
  if (provider === "deliverect") {
    if (
      integration?.deliverectRoutingLive === undefined ||
      integration.deliverectRoutingLive === null
    ) {
      return null;
    }
    return integration.deliverectRoutingLive;
  }
  return null;
}

export function getKitchenActionPolicy(
  vendor: KitchenActionPolicyVendorInput,
  order: KitchenActionPolicyOrderInput,
  integration?: KitchenActionPolicyIntegrationInput
): KitchenActionPolicy {
  const provider = normalizeProvider(vendor.orderRoutingMode);
  const providerDisplayName = getKitchenProviderDisplayName(provider);
  const routingFailed = isRoutingFailedWithoutExternalHandoff(order);
  const recovered = order.manuallyRecoveredAt != null;

  if (isManualDashboardRoutingMode(vendor.orderRoutingMode)) {
    return {
      actionsLocked: false,
      provider,
      providerDisplayName,
      reason: "Orders are managed in Open Order.",
      managedOrderBadge: getKitchenManagedOrderBadge(provider),
      kitchenLockTooltip: null,
      statusSyncAvailable: null,
      statusSyncCopy: null,
      recoveryAllowed: true,
      recoveryCopy: null,
      showProviderManagedState: false,
      routingFailed,
    };
  }

  if (recovered) {
    return {
      actionsLocked: false,
      provider,
      providerDisplayName,
      reason: null,
      managedOrderBadge: null,
      kitchenLockTooltip: null,
      statusSyncAvailable: resolveStatusSyncAvailable(provider, integration),
      statusSyncCopy: null,
      recoveryAllowed: true,
      recoveryCopy: getKitchenRecoveryCopy({ provider, routingFailed: false, recovered: true }),
      showProviderManagedState: false,
      routingFailed: false,
    };
  }

  if (routingFailed) {
    const statusSyncAvailable = resolveStatusSyncAvailable(provider, integration);
    return {
      actionsLocked: false,
      provider,
      providerDisplayName,
      reason: null,
      managedOrderBadge: null,
      kitchenLockTooltip: null,
      statusSyncAvailable,
      statusSyncCopy: getKitchenStatusSyncCopy({
        provider,
        statusSyncAvailable,
      }),
      recoveryAllowed: true,
      recoveryCopy: getKitchenRecoveryCopy({ provider, routingFailed: true, recovered: false }),
      showProviderManagedState: false,
      routingFailed: true,
    };
  }

  const squareManaged = isSquareExternallyManaged(vendor, order);
  const deliverectManaged = isDeliverectExternallyManaged(vendor, order);
  const externallyManaged = squareManaged || deliverectManaged;
  const statusSyncAvailable = resolveStatusSyncAvailable(provider, integration);

  if (!externallyManaged) {
    return {
      actionsLocked: false,
      provider,
      providerDisplayName,
      reason: null,
      managedOrderBadge: getKitchenManagedOrderBadge("manual_dashboard"),
      kitchenLockTooltip: null,
      statusSyncAvailable,
      statusSyncCopy: getKitchenStatusSyncCopy({ provider, statusSyncAvailable }),
      recoveryAllowed: true,
      recoveryCopy: null,
      showProviderManagedState: false,
      routingFailed: false,
    };
  }

  const lockMessage = getKitchenVendorLockMessage({ provider, statusSyncAvailable });

  return {
    actionsLocked: true,
    provider,
    providerDisplayName,
    reason: lockMessage,
    managedOrderBadge: getKitchenManagedOrderBadge(provider),
    kitchenLockTooltip: lockMessage,
    statusSyncAvailable,
    statusSyncCopy: getKitchenStatusSyncCopy({ provider, statusSyncAvailable }),
    recoveryAllowed: false,
    recoveryCopy: null,
    showProviderManagedState: true,
    routingFailed: false,
  };
}

export function vendorKitchenActionBlockedMessage(policy: KitchenActionPolicy): string {
  return (
    policy.kitchenLockTooltip ??
    policy.reason ??
    `This order is managed in ${policy.providerDisplayName}. Update it there instead.`
  );
}

export function canVendorMutateOrderFromKitchenPolicy(
  policy: KitchenActionPolicy,
  options?: { allowDegradedRoutingConfirm?: boolean }
): boolean {
  if (options?.allowDegradedRoutingConfirm) return true;
  if (policy.recoveryAllowed && !policy.actionsLocked) return true;
  return !policy.actionsLocked;
}

/** Server + shared: whether vendor dashboard may mutate fulfillment for this order. */
export function canVendorDashboardMutateFromPolicy(
  vendor: KitchenActionPolicyVendorInput,
  order: KitchenActionPolicyOrderInput,
  integration?: KitchenActionPolicyIntegrationInput,
  options?: { allowDegradedRoutingConfirm?: boolean }
): boolean {
  const policy = getKitchenActionPolicy(vendor, order, integration);
  return canVendorMutateOrderFromKitchenPolicy(policy, options);
}
