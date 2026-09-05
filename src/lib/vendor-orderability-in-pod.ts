import type { VendorAvailabilityInput } from "@/lib/vendor-availability";
import { getVendorAvailability } from "@/lib/vendor-availability";
import {
  POD_ORDERING_DISABLED_CART_MESSAGE,
  POD_ORDERING_DISABLED_CODE,
  POD_ORDERING_DISABLED_MESSAGE,
  resolveVendorOrderingIntent,
  VENDOR_ORDERING_DISABLED_CART_MESSAGE,
  VENDOR_ORDERING_DISABLED_CODE,
  VENDOR_ORDERING_DISABLED_MESSAGE,
} from "@/lib/vendor-ordering-mode";
import {
  getVendorOrderabilityState,
  vendorOrderabilityValidationError,
  type VendorReadinessEvaluationInput,
} from "@/lib/vendor-readiness-states";

export type VendorOrderabilityBlockReason =
  | "pod_inactive"
  | "pod_orders_paused"
  | "pod_ordering_disabled"
  | "vendor_ordering_disabled"
  | "pod_vendor_missing"
  | "pod_vendor_paused"
  | "vendor_inactive"
  | "vendor_closed"
  | "vendor_paused"
  | "vendor_not_public_ready"
  | "vendor_not_accepting_orders";

export type VendorOrderabilityInPodResult = {
  orderable: boolean;
  reason?: VendorOrderabilityBlockReason;
  code?: string;
  message?: string;
};

export type VendorOrderabilityInPodInput = {
  podActive: boolean;
  podOrdersPaused?: boolean;
  /** `Pod.orderingEnabled`. Undefined is treated as enabled. */
  podOrderingEnabled?: boolean;
  /** `Vendor.orderingEnabled`. Undefined is treated as enabled. */
  vendorOrderingEnabled?: boolean;
  podVendorExists: boolean;
  podVendorActive: boolean;
  vendor: VendorAvailabilityInput;
  /** When provided, enforces public profile + operational readiness rules. */
  readiness?: Omit<VendorReadinessEvaluationInput, "pod" | "podVendor" | "vendorAvailability">;
};

function mapValidationCodeToReason(code: string): VendorOrderabilityBlockReason {
  switch (code) {
    case "VENDOR_NOT_PUBLIC_READY":
      return "vendor_not_public_ready";
    case "VENDOR_CLOSED":
      return "vendor_closed";
    case "VENDOR_PAUSED_MENNYU":
      return "vendor_paused";
    case "POD_INACTIVE":
      return "pod_inactive";
    case "POD_ORDERS_PAUSED":
      return "pod_orders_paused";
    case POD_ORDERING_DISABLED_CODE:
      return "pod_ordering_disabled";
    case VENDOR_ORDERING_DISABLED_CODE:
      return "vendor_ordering_disabled";
    case "VENDOR_NOT_IN_POD":
      return "pod_vendor_missing";
    case "VENDOR_PAUSED_IN_POD":
      return "pod_vendor_paused";
    case "VENDOR_INACTIVE":
      return "vendor_inactive";
    default:
      return "vendor_not_accepting_orders";
  }
}

/**
 * Ordering intent, resolved from either the explicit flags or the readiness bundle.
 * Checked on both the readiness and shallow paths so a stale client can never bypass menu-only.
 */
function resolveIntent(input: VendorOrderabilityInPodInput) {
  return resolveVendorOrderingIntent({
    podOrderingEnabled: input.podOrderingEnabled,
    vendorOrderingEnabled:
      input.vendorOrderingEnabled ?? input.readiness?.vendor?.orderingEnabled,
  });
}

function buildReadinessEvaluation(
  input: VendorOrderabilityInPodInput
): VendorReadinessEvaluationInput | null {
  if (!input.readiness) return null;
  const intent = resolveIntent(input);
  return {
    ...input.readiness,
    vendor: { ...input.readiness.vendor, orderingEnabled: intent.vendorOrderingEnabled },
    pod: {
      isActive: input.podActive,
      mennyuOrdersPaused: input.podOrdersPaused,
      orderingEnabled: intent.podOrderingEnabled,
    },
    podVendor: { exists: input.podVendorExists, isActive: input.podVendorActive },
    vendorAvailability: input.vendor,
  };
}

/**
 * Whether a vendor can accept customer orders in a specific pod context.
 */
export function getVendorOrderabilityInPod(
  input: VendorOrderabilityInPodInput
): VendorOrderabilityInPodResult {
  const readinessEvaluation = buildReadinessEvaluation(input);
  if (readinessEvaluation) {
    const validation = vendorOrderabilityValidationError(readinessEvaluation);
    if (validation) {
      return {
        orderable: false,
        reason: mapValidationCodeToReason(validation.code),
        code: validation.code,
        message: validation.message,
      };
    }
    const state = getVendorOrderabilityState(readinessEvaluation);
    if (!state.orderable) {
      return {
        orderable: false,
        reason: "vendor_not_accepting_orders",
        code: "VENDOR_NOT_ACCEPTING_ORDERS",
        message: state.customerBannerLine ?? "This vendor is not accepting orders right now.",
      };
    }
    return { orderable: true };
  }

  if (!input.podActive) {
    return {
      orderable: false,
      reason: "pod_inactive",
      code: "POD_INACTIVE",
      message: "This pod is not currently accepting orders.",
    };
  }
  /**
   * Ordering intent is enforced on the shallow path too: callers that skip the readiness
   * bundle (cart display, quantity updates) must still reject menu-only vendors/pods.
   */
  const intent = resolveIntent(input);
  if (!intent.podOrderingEnabled) {
    return {
      orderable: false,
      reason: "pod_ordering_disabled",
      code: POD_ORDERING_DISABLED_CODE,
      message: POD_ORDERING_DISABLED_MESSAGE,
    };
  }
  if (!intent.vendorOrderingEnabled) {
    return {
      orderable: false,
      reason: "vendor_ordering_disabled",
      code: VENDOR_ORDERING_DISABLED_CODE,
      message: VENDOR_ORDERING_DISABLED_MESSAGE,
    };
  }
  if (input.podOrdersPaused) {
    return {
      orderable: false,
      reason: "pod_orders_paused",
      code: "POD_ORDERS_PAUSED",
      message: "This pod is paused and not accepting orders right now.",
    };
  }
  if (!input.podVendorExists) {
    return {
      orderable: false,
      reason: "pod_vendor_missing",
      code: "VENDOR_NOT_IN_POD",
      message: "This vendor is no longer accepting orders at this pod.",
    };
  }
  if (!input.podVendorActive) {
    return {
      orderable: false,
      reason: "pod_vendor_paused",
      code: "VENDOR_PAUSED_IN_POD",
      message: "This vendor is no longer accepting orders at this pod.",
    };
  }

  const vendorAvailability = getVendorAvailability(input.vendor);
  if (!vendorAvailability.orderable) {
    if (vendorAvailability.status === "inactive") {
      return {
        orderable: false,
        reason: "vendor_inactive",
        code: "VENDOR_INACTIVE",
        message: "This vendor is not currently available.",
      };
    }
    if (vendorAvailability.status === "closed") {
      return {
        orderable: false,
        reason: "vendor_closed",
        code: "VENDOR_CLOSED",
        message: "This vendor is currently closed.",
      };
    }
    return {
      orderable: false,
      reason: "vendor_paused",
      code: "VENDOR_PAUSED_MENNYU",
      message: "This vendor is paused right now.",
    };
  }

  return { orderable: true };
}

export function isVendorOrderableInPod(input: VendorOrderabilityInPodInput): boolean {
  return getVendorOrderabilityInPod(input).orderable;
}

/** Cart/checkout copy when a line fails pod-context orderability. */
export function cartLineOrderabilityMessage(result: VendorOrderabilityInPodResult): string {
  if (result.orderable) return "";
  if (result.reason === "pod_inactive") {
    return "This pod is not currently accepting orders.";
  }
  if (result.reason === "pod_orders_paused") {
    return "This pod is paused and not accepting orders right now.";
  }
  /** Menu-only cart copy is action-oriented: the customer must remove the lines. */
  if (result.reason === "pod_ordering_disabled") {
    return POD_ORDERING_DISABLED_CART_MESSAGE;
  }
  if (result.reason === "vendor_ordering_disabled") {
    return VENDOR_ORDERING_DISABLED_CART_MESSAGE;
  }
  if (result.reason === "pod_vendor_missing" || result.reason === "pod_vendor_paused") {
    return "This vendor is no longer accepting orders at this pod.";
  }
  if (result.reason === "vendor_inactive") {
    return "This vendor is no longer active.";
  }
  if (result.reason === "vendor_closed") {
    return "This vendor is currently closed.";
  }
  if (result.reason === "vendor_not_public_ready") {
    return "This vendor is not available right now.";
  }
  if (result.reason === "vendor_paused" || result.reason === "vendor_not_accepting_orders") {
    return "This vendor is not accepting orders right now.";
  }
  return result.message ?? "This vendor is not available right now.";
}

/** Cart/checkout error code for a failed pod-context orderability check. */
export function cartLineOrderabilityCode(result: VendorOrderabilityInPodResult): string {
  if (result.orderable) return "";
  return result.code ?? "VENDOR_NOT_IN_POD";
}
