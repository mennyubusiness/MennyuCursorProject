import type { VendorAvailabilityInput } from "@/lib/vendor-availability";
import { getVendorAvailability } from "@/lib/vendor-availability";

export type VendorOrderabilityBlockReason =
  | "pod_inactive"
  | "pod_orders_paused"
  | "pod_vendor_missing"
  | "pod_vendor_paused"
  | "vendor_inactive"
  | "vendor_closed"
  | "vendor_paused";

export type VendorOrderabilityInPodResult = {
  orderable: boolean;
  reason?: VendorOrderabilityBlockReason;
  code?: string;
  message?: string;
};

export type VendorOrderabilityInPodInput = {
  podActive: boolean;
  podOrdersPaused?: boolean;
  podVendorExists: boolean;
  podVendorActive: boolean;
  vendor: VendorAvailabilityInput;
};

/**
 * Whether a vendor can accept customer orders in a specific pod context.
 * Checks pod state, pod membership, pod-level pause, then vendor global availability.
 */
export function getVendorOrderabilityInPod(
  input: VendorOrderabilityInPodInput
): VendorOrderabilityInPodResult {
  if (!input.podActive) {
    return {
      orderable: false,
      reason: "pod_inactive",
      code: "POD_INACTIVE",
      message: "This pod is not currently accepting orders.",
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
  if (result.reason === "pod_vendor_missing" || result.reason === "pod_vendor_paused") {
    return "This vendor is no longer accepting orders at this pod.";
  }
  if (result.reason === "vendor_inactive") {
    return "This vendor is no longer active.";
  }
  if (result.reason === "vendor_closed") {
    return "This vendor is currently closed.";
  }
  if (result.reason === "vendor_paused") {
    return "This vendor is not accepting orders right now.";
  }
  return result.message ?? "This vendor is not available right now.";
}

/** Cart/checkout error code for a failed pod-context orderability check. */
export function cartLineOrderabilityCode(result: VendorOrderabilityInPodResult): string {
  if (result.orderable) return "";
  return result.code ?? "VENDOR_NOT_IN_POD";
}
