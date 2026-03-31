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

/** Matches DELIVERECT_STATUS_NAME_TO_CODE CANCELLED / CANCELED in payload-status-read.ts */
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
  console.info("[TRACE customer cancel] notifyDeliverectOfCustomerCancellation: helper entered", {
    vendorOrderId,
  });

  const vo = await prisma.vendorOrder.findUnique({
    where: { id: vendorOrderId },
    select: {
      id: true,
      deliverectOrderId: true,
      deliverectChannelLinkId: true,
    },
  });

  if (!vo) {
    console.info("[TRACE customer cancel] notify helper skip — exact reason", {
      vendorOrderId,
      reason: "vendor_order_row_not_found_after_transition",
    });
    return;
  }

  const deliverectOrderId = vo.deliverectOrderId?.trim();
  const channelLinkId = vo.deliverectChannelLinkId?.trim() ?? null;

  if (!deliverectOrderId) {
    const raw = vo.deliverectOrderId;
    const reason =
      raw == null
        ? "deliverectOrderId_is_null"
        : String(raw).trim() === ""
          ? "deliverectOrderId_is_empty_string"
          : "deliverectOrderId_is_whitespace_only";
    console.info("[TRACE customer cancel] notify helper skip — exact reason", {
      vendorOrderId: vo.id,
      channelLinkId,
      deliverectOrderIdRaw: raw,
      reason,
      note: "no_outbound_http_without_deliverect_order_id",
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
