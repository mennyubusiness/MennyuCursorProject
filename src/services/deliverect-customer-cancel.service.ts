/**
 * After Mennyu records a customer-initiated cancellation, notify Deliverect so POS can reflect it.
 * Local cancel + refund stay authoritative; this is best-effort outbound (logs on failure).
 *
 * Uses POST /orderStatus/{deliverectOrderId} with status 110 (CANCELLED), same as admin simulate.
 */
import { prisma } from "@/lib/db";
import {
  getDeliverectOrderStatusPushUrl,
  postDeliverectOrderStatusUpdate,
} from "@/integrations/deliverect/client";

/** Matches {@link DELIVERECT_STATUS_NAME_TO_CODE} CANCELLED / CANCELED in payload-status-read.ts */
const DELIVERECT_CANCEL_STATUS_CODE = 110;

function safeBodyForLog(body: unknown): string {
  try {
    const s = JSON.stringify(body);
    return s.length > 2000 ? `${s.slice(0, 2000)}…` : s;
  } catch {
    return String(body);
  }
}

/**
 * If this vendor order was sent to Deliverect (`deliverectOrderId` set), push cancel status 110.
 * Call after `applyVendorOrderTransition(..., "cancelled", "customer")` succeeds.
 */
export async function notifyDeliverectOfCustomerCancellation(vendorOrderId: string): Promise<void> {
  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      deliverectOrderId: true,
      deliverectChannelLinkId: true,
    },
  });

  if (!vo) {
    console.warn("[Deliverect customer cancel] vendor order not found", { vendorOrderId });
    return;
  }

  const deliverectOrderId = vo.deliverectOrderId?.trim();
  const channelLinkId = vo.deliverectChannelLinkId?.trim() ?? null;

  if (!deliverectOrderId) {
    console.info("[Deliverect customer cancel] skip — no Deliverect order id (not routed or id pending)", {
      vendorOrderId: vo.id,
      channelLinkId,
    });
    return;
  }

  const url = getDeliverectOrderStatusPushUrl(deliverectOrderId);
  console.info("[Deliverect customer cancel] outbound attempt", {
    vendorOrderId: vo.id,
    deliverectOrderId,
    channelLinkId,
    method: "POST",
    url,
    body: { status: DELIVERECT_CANCEL_STATUS_CODE },
  });

  try {
    const { httpStatus, body } = await postDeliverectOrderStatusUpdate(
      deliverectOrderId,
      DELIVERECT_CANCEL_STATUS_CODE
    );
    console.info("[Deliverect customer cancel] response", {
      vendorOrderId: vo.id,
      deliverectOrderId,
      channelLinkId,
      httpStatus,
      responseBody: safeBodyForLog(body),
    });
  } catch (e) {
    console.error("[Deliverect customer cancel] request error (Mennyu cancel already applied)", {
      vendorOrderId: vo.id,
      deliverectOrderId,
      channelLinkId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
