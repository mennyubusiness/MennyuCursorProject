/**
 * Derived vendor readiness in a pod context — setup visibility only.
 * Does not replace customer orderability gates (see vendor-orderability-in-pod.ts).
 */
import { buildVendorMenuCustomerPath } from "@/lib/customer-public-url";
import type { PosConnectionStatus } from "@prisma/client";
import { deriveVendorPosUiState } from "@/lib/vendor-pos-ui-state";
import { hasValidVendorCustomerOrderingHours } from "@/lib/vendor-customer-ordering-hours";
import {
  getVendorOrderabilityState,
  getVendorPublicProfileMissingItems,
  isVendorPublicProfileFieldsComplete,
  isVendorPublicProfileReady,
  type VendorReadinessEvaluationInput,
} from "@/lib/vendor-readiness-states";

export type ReadinessOwner = "pod_owner" | "vendor" | "open_order";

export type VendorPodReadinessStatus =
  | "pod_inactive"
  | "inactive_by_open_order"
  | "paused_by_vendor"
  | "paused_in_pod"
  | "needs_profile"
  | "needs_payment"
  | "needs_pos"
  | "needs_menu"
  | "needs_hours"
  | "ready"
  | "active";

export type VendorMenuReadinessSummary = import("@/lib/vendor-readiness-states").VendorMenuReadinessSummary;
export type VendorStripeReadinessSummary = import("@/lib/vendor-readiness-states").VendorStripeReadinessSummary;
export type VendorPosReadinessSummary = import("@/lib/vendor-readiness-states").VendorPosReadinessSummary;
export type VendorReadinessVendorFields = import("@/lib/vendor-readiness-states").VendorReadinessVendorFields;

export {
  isVendorPublicProfileReady,
  isVendorPublicProfileFieldsComplete,
  getVendorPublicProfileMissingItems,
  getVendorPodOwnerDisplaySummary,
} from "@/lib/vendor-readiness-states";

export type ReadinessChecklistItem = {
  key: string;
  label: string;
  complete: boolean;
  owner: ReadinessOwner;
  actionHref?: string;
  actionLabel?: string;
  description?: string;
};

export type ReadinessBlockingReason = {
  code: string;
  label: string;
  description: string;
  owner: ReadinessOwner;
  actionHref?: string;
  actionLabel?: string;
};

export type VendorPodReadinessInput = {
  podId: string;
  podSlug?: string;
  vendorId: string;
  pod: { isActive: boolean };
  podVendor: { isActive: boolean } | null;
  vendor: VendorReadinessVendorFields;
  menuSummary: VendorMenuReadinessSummary;
  posSummary: VendorPosReadinessSummary;
  stripeSummary: VendorStripeReadinessSummary;
  /** Vendor self-serve checklist: pending pod invites. */
  pendingPodInviteCount?: number;
  /** Vendor has accepted membership in any pod (for invite checklist). */
  hasPodMembership?: boolean;
  /** Saved manual customer ordering hours JSON. */
  customerOrderingHours?: unknown;
};

export type VendorPodReadinessResult = {
  status: VendorPodReadinessStatus;
  label: string;
  description: string;
  blockingReasons: ReadinessBlockingReason[];
  checklist: ReadinessChecklistItem[];
  setupSummary: {
    profile: boolean;
    publicProfile: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
    hours: boolean;
  };
  canAcceptOrders: boolean;
};

/** Profile presentation fields (name, description, banner, cuisine) — excludes menu and hours. */
export function isVendorProfileComplete(
  vendor: Pick<VendorReadinessVendorFields, "name" | "description" | "imageUrl" | "cuisineCategory">
): boolean {
  return isVendorPublicProfileFieldsComplete(vendor);
}

function toReadinessEvaluationInput(input: VendorPodReadinessInput): VendorReadinessEvaluationInput {
  return {
    vendor: { ...input.vendor, customerOrderingHours: input.customerOrderingHours },
    menuSummary: input.menuSummary,
    stripeSummary: input.stripeSummary,
    posSummary: input.posSummary,
    pod: input.pod,
    podVendor: input.podVendor
      ? { exists: true, isActive: input.podVendor.isActive }
      : { exists: false, isActive: false },
  };
}

/** Mirrors vendor-payout-transfer.service isVendorConnectPayoutReady (charges + payouts + account id). */
export function isVendorStripePayoutReady(stripe: VendorStripeReadinessSummary): boolean {
  if (stripe.stripeConnectConfigured === false) return false;
  return Boolean(
    stripe.stripeConnectedAccountId?.trim() &&
      stripe.stripeChargesEnabled &&
      stripe.stripePayoutsEnabled
  );
}

/** POS routing is ready when Deliverect channel link is attached (same as connected UI state). */
export function isVendorPosReady(pos: VendorPosReadinessSummary): boolean {
  return (
    deriveVendorPosUiState({
      deliverectChannelLinkId: pos.deliverectChannelLinkId,
      posConnectionStatus: pos.posConnectionStatus,
      deliverectAutoMapLastOutcome: pos.deliverectAutoMapLastOutcome,
      pendingDeliverectConnectionKey: pos.pendingDeliverectConnectionKey,
      hasUnmatchedChannelRegistrationForVendor: pos.hasUnmatchedChannelRegistration,
    }) === "connected"
  );
}

/**
 * Menu is ready when at least one operational item is currently available to order.
 * Limitation: does not evaluate every modifier/snooze edge case — uses operational scope + isAvailable.
 */
export function isVendorMenuReady(menu: VendorMenuReadinessSummary): boolean {
  return menu.hasAvailableOperationalItems;
}

export function isVendorCustomerOrderingHoursReady(customerOrderingHours: unknown): boolean {
  return hasValidVendorCustomerOrderingHours(customerOrderingHours);
}

/** Checklist keys required before a vendor appears on the public pod page. */
export const VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS = ["profile", "cuisine", "menu", "hours"] as const;

/** Checklist keys required before a vendor can accept orders. */
export const VENDOR_ACCEPTING_ORDERS_CHECKLIST_KEYS = [
  "stripe",
  "pos",
  "menu_available",
  "pod_invite",
] as const;

/** Vendor self-serve setup checklist keys required before setup is considered complete. */
export const VENDOR_SETUP_REQUIRED_CHECKLIST_KEYS = [
  ...VENDOR_PUBLIC_APPEARANCE_CHECKLIST_KEYS,
  ...VENDOR_ACCEPTING_ORDERS_CHECKLIST_KEYS,
] as const;

export function vendorPodReadinessStatusLabel(status: VendorPodReadinessStatus): string {
  switch (status) {
    case "pod_inactive":
      return "Pod inactive";
    case "inactive_by_open_order":
      return "Inactive by Open Order";
    case "paused_by_vendor":
      return "Paused by vendor";
    case "paused_in_pod":
      return "Paused in this pod";
    case "needs_profile":
      return "Needs vendor setup";
    case "needs_payment":
      return "Waiting on Stripe payouts";
    case "needs_pos":
      return "Waiting on POS/menu connection";
    case "needs_menu":
      return "Menu unavailable";
    case "needs_hours":
      return "Hours need setup";
    case "ready":
      return "Ready for orders";
    case "active":
      return "Active in pod";
    default:
      return "Needs setup";
  }
}

function podOwnerVendorHref(podId: string, podSlug: string | undefined, vendorSlug: string): string {
  if (podSlug?.trim()) {
    return buildVendorMenuCustomerPath(podSlug, vendorSlug);
  }
  return `/pod/${podId}/vendor/${vendorSlug}`;
}

function buildSetupChecklist(input: VendorPodReadinessInput, audience: "pod_owner" | "vendor"): ReadinessChecklistItem[] {
  const { podId, podSlug, vendorId, vendor, menuSummary, posSummary, stripeSummary } = input;
  const profileComplete = isVendorProfileComplete(vendor);
  const stripeComplete = isVendorStripePayoutReady(stripeSummary);
  const posComplete = isVendorPosReady(posSummary);
  const menuComplete = isVendorMenuReady(menuSummary);
  const posState = deriveVendorPosUiState({
    deliverectChannelLinkId: posSummary.deliverectChannelLinkId,
    posConnectionStatus: posSummary.posConnectionStatus,
    deliverectAutoMapLastOutcome: posSummary.deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey: posSummary.pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: posSummary.hasUnmatchedChannelRegistration,
  });

  const settingsBase = `/vendor/${vendorId}/settings`;
  const profileHref =
    audience === "vendor" ? `${settingsBase}?section=profile` : podOwnerVendorHref(podId, podSlug, vendor.slug);
  const profileAction =
    audience === "vendor" ? "Edit profile" : "View vendor page";

  const items: ReadinessChecklistItem[] = [
    {
      key: "profile",
      label: "Complete vendor profile",
      complete: profileComplete,
      owner: "vendor",
      description: "Name, description, banner photo, and cuisine on the pod menu.",
      actionHref: profileHref,
      actionLabel: profileAction,
    },
    {
      key: "cuisine",
      label: "Set cuisine category",
      complete: Boolean(vendor.cuisineCategory?.trim()),
      owner: "vendor",
      description: "Helps customers understand what you serve.",
      actionHref: audience === "vendor" ? `${settingsBase}?section=profile` : profileHref,
      actionLabel: audience === "vendor" ? "Edit profile" : profileAction,
    },
    {
      key: "menu",
      label: "Publish menu",
      complete: menuSummary.hasOperationalItems,
      owner: "vendor",
      description: menuSummary.hasOperationalItems
        ? "Menu items are available on your public page."
        : "Publish or import a menu before appearing on the pod page.",
      actionHref:
        audience === "vendor" ? `/vendor/${vendorId}/menu` : podOwnerVendorHref(podId, podSlug, vendor.slug),
      actionLabel: audience === "vendor" ? "Review menu" : "View menu page",
    },
    {
      key: "stripe",
      label: "Connect Stripe payouts",
      complete: stripeComplete,
      owner: "vendor",
      description:
        stripeSummary.stripeConnectConfigured === false
          ? "Stripe Connect is not configured on this server."
          : "Stripe Connect account with charges and payouts enabled.",
      actionHref: audience === "vendor" ? `/vendor/${vendorId}/payouts` : undefined,
      actionLabel: audience === "vendor" ? "Set up payouts" : undefined,
    },
    {
      key: "pos",
      label: "Connect or confirm POS/menu",
      complete: posComplete,
      owner: "vendor",
      description:
        posState === "connected"
          ? "Kitchen routing is connected through Deliverect."
          : "Connect Deliverect so orders can route to the kitchen POS.",
      actionHref:
        audience === "vendor"
          ? `/vendor/${vendorId}/setup`
          : undefined,
      actionLabel: audience === "vendor" ? "Connect POS" : undefined,
    },
    {
      key: "menu_available",
      label: "Confirm menu availability",
      complete: menuComplete,
      owner: "vendor",
      description: menuSummary.hasOperationalItems
        ? menuComplete
          ? "At least one menu item is available to order."
          : "Menu items exist but none are available right now."
        : "Publish or import a menu with at least one available item.",
      actionHref:
        audience === "vendor" ? `/vendor/${vendorId}/menu` : podOwnerVendorHref(podId, podSlug, vendor.slug),
      actionLabel: audience === "vendor" ? "Review menu" : "View menu page",
    },
  ];

  if (audience === "vendor") {
    const inviteComplete =
      (input.pendingPodInviteCount ?? 0) === 0 && Boolean(input.hasPodMembership);
    const hoursComplete = isVendorCustomerOrderingHoursReady(input.customerOrderingHours);
    items.push({
      key: "hours",
      label: "Customer ordering hours",
      complete: hoursComplete,
      owner: "vendor",
      description: hoursComplete
        ? "Customer ordering hours set."
        : "Set customer ordering hours before appearing on your pod page.",
      actionHref: `/vendor/${vendorId}/hours`,
      actionLabel: "Set hours",
    });
    items.push({
      key: "pod_invite",
      label: "Accept pod invitations",
      complete: inviteComplete,
      owner: "vendor",
      description:
        (input.pendingPodInviteCount ?? 0) > 0
          ? `${input.pendingPodInviteCount} pending invitation(s) below.`
          : input.hasPodMembership
            ? "You are linked to a pod."
            : "Join a pod when a pod owner invites you.",
      actionHref: `${settingsBase}?section=pod-membership`,
      actionLabel: "View invitations",
    });
    items.push({
      key: "kitchen",
      label: "Use Kitchen Mode for orders",
      complete: true,
      owner: "vendor",
      description: "Manage live orders from the vendor Orders board.",
      actionHref: `/vendor/${vendorId}/kitchen`,
      actionLabel: "Open Kitchen Mode",
    });
  }

  return items;
}

function blockingFromChecklist(
  checklist: ReadinessChecklistItem[],
  codes: string[]
): ReadinessBlockingReason[] {
  return checklist
    .filter((item) => !item.complete && codes.includes(item.key))
    .map((item) => ({
      code: item.key,
      label: item.label,
      description: item.description ?? item.label,
      owner: item.owner,
      actionHref: item.actionHref,
      actionLabel: item.actionLabel,
    }));
}

function derivePrimaryStatus(
  input: VendorPodReadinessInput,
  setup: {
    profile: boolean;
    publicProfile: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
    hours: boolean;
  },
  canAcceptOrders: boolean
): VendorPodReadinessStatus {
  if (!input.pod.isActive) return "pod_inactive";
  if (!input.vendor.isActive) return "inactive_by_open_order";
  if (input.vendor.mennyuOrdersPaused) return "paused_by_vendor";
  if (!input.podVendor?.isActive) return "paused_in_pod";

  const publicMissing = getVendorPublicProfileMissingItems(toReadinessEvaluationInput(input));
  if (
    publicMissing.some((key) => key === "name" || key === "description" || key === "banner" || key === "cuisine")
  ) {
    return "needs_profile";
  }
  if (publicMissing.includes("menu")) return "needs_menu";
  if (publicMissing.includes("hours")) return "needs_hours";

  if (!setup.stripe) return "needs_payment";
  if (!setup.pos) return "needs_pos";
  if (!setup.menu) return "needs_menu";
  return canAcceptOrders ? "active" : "ready";
}

function statusDescription(status: VendorPodReadinessStatus, primaryBlocker: ReadinessBlockingReason | null): string {
  switch (status) {
    case "pod_inactive":
      return "Open Order has not activated this pod for customer ordering yet.";
    case "inactive_by_open_order":
      return "This vendor account is inactive platform-wide.";
    case "paused_by_vendor":
      return "The vendor paused new orders across Open Order.";
    case "paused_in_pod":
      return "You paused this vendor in your pod — customers cannot order from them here.";
    case "needs_profile":
    case "needs_payment":
    case "needs_pos":
    case "needs_menu":
    case "needs_hours":
      return primaryBlocker?.description ?? "Setup is still in progress.";
    case "active":
      return "Setup is complete and this vendor can accept orders in your pod.";
    case "ready":
      return "Setup is complete. Check ordering status if customers still cannot order.";
    default:
      return "";
  }
}

export function deriveVendorPodReadiness(
  input: VendorPodReadinessInput,
  opts?: { audience?: "pod_owner" | "vendor" }
): VendorPodReadinessResult {
  const audience = opts?.audience ?? "pod_owner";
  const evaluation = toReadinessEvaluationInput(input);
  const setupSummary = {
    profile: isVendorProfileComplete(input.vendor),
    publicProfile: isVendorPublicProfileReady(evaluation),
    stripe: isVendorStripePayoutReady(input.stripeSummary),
    pos: isVendorPosReady(input.posSummary),
    menu: isVendorMenuReady(input.menuSummary),
    hours: isVendorCustomerOrderingHoursReady(input.customerOrderingHours),
  };

  const orderabilityState = getVendorOrderabilityState(evaluation);
  const canAcceptOrders = orderabilityState.orderable;

  const status = derivePrimaryStatus(input, setupSummary, canAcceptOrders);
  const checklist = buildSetupChecklist(input, audience);

  const blockingReasons: ReadinessBlockingReason[] = [];
  if (status === "pod_inactive") {
    blockingReasons.push({
      code: "pod_inactive",
      label: "Pod activation",
      description: "This pod is not active for customer ordering.",
      owner: "open_order",
    });
  } else if (status === "inactive_by_open_order") {
    blockingReasons.push({
      code: "vendor_inactive",
      label: "Vendor inactive",
      description: "Open Order has deactivated this vendor account.",
      owner: "open_order",
    });
  } else if (status === "paused_by_vendor") {
    blockingReasons.push({
      code: "vendor_paused",
      label: "Paused by vendor",
      description: "The vendor paused new orders in vendor settings.",
      owner: "vendor",
    });
  } else if (status === "paused_in_pod") {
    blockingReasons.push({
      code: "paused_in_pod",
      label: "Paused in this pod",
      description: "You hid this vendor from your public pod page.",
      owner: "pod_owner",
      actionLabel: "Show in pod",
    });
  } else if (status.startsWith("needs_")) {
    const code =
      status === "needs_profile"
        ? "profile"
        : status === "needs_payment"
          ? "stripe"
          : status === "needs_pos"
            ? "pos"
            : status === "needs_hours"
              ? "hours"
              : "menu";
    blockingReasons.push(...blockingFromChecklist(checklist, [code]));
  }

  const label = vendorPodReadinessStatusLabel(status);
  const primaryBlocker = blockingReasons[0] ?? null;

  return {
    status,
    label,
    description: statusDescription(status, primaryBlocker),
    blockingReasons,
    checklist,
    setupSummary,
    canAcceptOrders,
  };
}

/** Pod-owner dashboard: compact setup flags only (no vendor-private action links). */
export function deriveVendorPodReadinessForRoster(
  input: VendorPodReadinessInput
): Pick<
  VendorPodReadinessResult,
  "status" | "label" | "description" | "blockingReasons" | "setupSummary" | "canAcceptOrders"
> {
  const full = deriveVendorPodReadiness(input, { audience: "pod_owner" });
  return {
    status: full.status,
    label: full.label,
    description: full.description,
    blockingReasons: full.blockingReasons,
    setupSummary: full.setupSummary,
    canAcceptOrders: full.canAcceptOrders,
  };
}

export type PodSetupChecklistInput = {
  podId: string;
  pod: {
    isActive: boolean;
    name: string;
    description: string | null;
    imageUrl: string | null;
    address: string | null;
    slug: string;
    pickupInstructions: string | null;
  };
  vendorStatuses: Array<{ canAcceptOrders: boolean; status: VendorPodReadinessStatus }>;
  podPayoutsEnabled?: boolean;
  payoutSetupReady?: boolean;
};

/** Pod self-serve checklist keys required before the pod is ready for customers. */
export const POD_SETUP_REQUIRED_CHECKLIST_KEYS = [
  "pod_profile",
  "location",
  "pod_active",
  "vendor_ready",
] as const;

/** Optional pod owner tools — not required for customer ordering. */
export const POD_SETUP_OPTIONAL_CHECKLIST_KEYS = ["qr_signage", "payout_setup"] as const;

export function derivePodSetupChecklist(input: PodSetupChecklistInput): ReadinessChecklistItem[] {
  const { podId, pod, vendorStatuses } = input;
  const profileComplete = Boolean(
    pod.name?.trim() && (pod.description?.trim() || pod.address?.trim()) && pod.imageUrl?.trim()
  );
  const locationComplete = Boolean(pod.address?.trim());
  const hasOrderableVendor = vendorStatuses.some((v) => v.canAcceptOrders);
  const hasReadyVendor = vendorStatuses.some(
    (v) => v.canAcceptOrders || v.status === "ready" || v.status === "active"
  );
  const qrComplete = Boolean(pod.slug?.trim());

  const items: ReadinessChecklistItem[] = [
    {
      key: "pod_profile",
      label: "Pod profile complete",
      complete: profileComplete,
      owner: "pod_owner",
      description: "Name, hero image, and description on the public pod page.",
      actionHref: `/pod/${podId}/settings`,
      actionLabel: "Edit pod profile",
    },
    {
      key: "location",
      label: "Location set",
      complete: locationComplete,
      owner: "pod_owner",
      description: "Add the address customers see on your public pod page.",
      actionHref: `/pod/${podId}/settings`,
      actionLabel: "Edit location",
    },
    {
      key: "pod_active",
      label: "Public page active",
      complete: pod.isActive,
      owner: "open_order",
      description: pod.isActive
        ? "This pod is active for customer ordering."
        : "Open Order activates pods for public ordering.",
    },
    {
      key: "vendor_ready",
      label: "At least one orderable vendor",
      complete: hasOrderableVendor,
      owner: "pod_owner",
      description: hasOrderableVendor
        ? "A vendor can accept orders in this pod."
        : "Invite vendors and help them finish setup.",
      actionHref: `/pod/${podId}/vendors`,
      actionLabel: "Manage vendors",
    },
    {
      key: "qr_signage",
      label: "QR and signage available",
      complete: qrComplete,
      owner: "pod_owner",
      description: "Share your public pod page with a QR code or link.",
      actionHref: `/pod/${podId}/promote`,
      actionLabel: "Open Promote",
    },
  ];

  if (input.podPayoutsEnabled) {
    items.push({
      key: "payout_setup",
      label: "Payout account set up",
      complete: Boolean(input.payoutSetupReady),
      owner: "pod_owner",
      description: "Connect the payout account for your pod share.",
      actionHref: `/pod/${podId}/payouts`,
      actionLabel: "Set up payouts",
    });
  }

  if (!hasReadyVendor && !hasOrderableVendor) {
    // Keep legacy key out of required list; vendor_ready covers orderable state.
  }

  return items;
}
