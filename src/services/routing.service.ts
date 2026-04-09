/**
 * Routing abstraction: single entry point for vendor-order routing.
 * Callers use this service instead of Deliverect-specific modules.
 *
 * Provider selection: Deliverect when vendor (or VO) has deliverectChannelLinkId set;
 * otherwise manual/no-op path. Future: explicit Vendor.routingProvider or capability flag.
 * - cancelVendorOrderRouting(vendorOrderId) when cancellation to POS is required.
 */

import { prisma } from "@/lib/db";
import { submitVendorOrderToDeliverect } from "@/services/deliverect.service";
import { applyVendorOrderStatusWithMeta } from "@/services/vendor-order-status-instrumentation";

/** Normalized result for any routing backend. Keeps callers independent of provider. */
export interface RoutingResult {
  success: boolean;
  /** External order id from the routing provider (e.g. Deliverect order id). */
  externalOrderId?: string;
  error?: string;
  /** e.g. VALIDATION_FAILED, SUBMISSION_FAILED. Provider-specific codes can be mapped here. */
  code?: string;
  /** True when routing was not performed (e.g. mock mode, or vendor not configured for routing). */
  skipped?: boolean;
}

export interface SubmitVendorOrderContext {
  customerPhone: string;
  customerEmail: string | null;
  preparationTimeMinutes?: number;
}

const DEFAULT_PREP_MINUTES = 15;

/**
 * Submit a vendor order for routing. Used after payment (post-payment flow) and by any flow
 * that needs to send a pending vendor order to the kitchen/POS.
 *
 * Chooses path by vendor config: Deliverect when channel link ID is set; otherwise manual
 * (VO set to routingStatus confirmed and history recorded; vendor handles order manually or via other means).
 */
export async function submitVendorOrder(
  vendorOrderId: string,
  context: SubmitVendorOrderContext
): Promise<RoutingResult> {
  const voHead = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      deliverectChannelLinkId: true,
      vendor: { select: { deliverectChannelLinkId: true, deliverectBusyDelayMinutes: true } },
    },
  });
  if (!voHead) {
    return { success: false, error: "Vendor order not found" };
  }
  const channelLinkId =
    voHead.vendor.deliverectChannelLinkId ?? voHead.deliverectChannelLinkId;
  const provider: "deliverect" | "manual" =
    channelLinkId != null && String(channelLinkId).trim() !== "" ? "deliverect" : "manual";
  const busyDelay = voHead.vendor.deliverectBusyDelayMinutes ?? 0;

  if (provider === "manual") {
    const vo = await prisma.vendorOrder.findUnique({
      where: { id: vendorOrderId },
      select: {
        orderId: true,
        fulfillmentStatus: true,
        statusAuthority: true,
      },
    });
    if (!vo) {
      return { success: false, error: "Vendor order not found" };
    }
    await applyVendorOrderStatusWithMeta(
      {
        vendorOrderId,
        orderId: vo.orderId,
        patch: { routingStatus: "confirmed" },
        statusSource: "system",
        historySource: "manual",
        extraVendorOrderUpdate:
          vo.statusAuthority == null ? { statusAuthority: "vendor_manual" } : {},
        historyRoutingStatus: "confirmed",
        historyFulfillmentStatus: vo.fulfillmentStatus,
      },
      "manual"
    );
    return { success: true, skipped: true };
  }

  const prep = Math.max(
    context.preparationTimeMinutes ?? DEFAULT_PREP_MINUTES,
    busyDelay
  );
  const result = await submitVendorOrderToDeliverect(
    vendorOrderId,
    context.customerPhone,
    context.customerEmail,
    prep
  );
  if (!result.success && !result.skipped) {
    console.warn(
      JSON.stringify({
        event: "submit_vendor_order_failed",
        scope: "routing",
        vendorOrderId,
        preparationTimeMinutes: prep,
        error: result.error ?? null,
        code: result.code ?? null,
      })
    );
  }
  if (result.success) {
    const cur = await prisma.vendorOrder.findUnique({
      where: { id: vendorOrderId },
      select: { statusAuthority: true },
    });
    // Do not mark POS-managed until a Deliverect webhook proves sync (promoted there).
    // Until then, vendor may use dashboard; explicit vendor_manual avoids legacy infer edge cases.
    await prisma.vendorOrder.update({
      where: { id: vendorOrderId },
      data: {
        lastStatusSource: "system",
        ...(cur?.statusAuthority == null ? { statusAuthority: "vendor_manual" } : {}),
      },
    });
  }
  return {
    success: result.success,
    externalOrderId: result.deliverectOrderId,
    error: result.error,
    code: result.code,
    skipped: result.skipped,
  };
}

/**
 * Retry routing for a vendor order (e.g. admin "Retry routing" from Needs Attention).
 * Loads order context and calls submitVendorOrder. Use when the vendor order already exists
 * and may have failed a previous submission.
 */
export async function retryVendorOrderRouting(vendorOrderId: string): Promise<RoutingResult> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    include: { order: { select: { customerPhone: true, customerEmail: true } } },
  });
  if (!vo) {
    return { success: false, error: "Vendor order not found" };
  }
  return submitVendorOrder(vendorOrderId, {
    customerPhone: vo.order.customerPhone,
    customerEmail: vo.order.customerEmail ?? null,
    preparationTimeMinutes: DEFAULT_PREP_MINUTES,
  });
}
