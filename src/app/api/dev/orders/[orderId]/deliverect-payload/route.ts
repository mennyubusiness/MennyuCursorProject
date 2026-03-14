/**
 * Dev-only: inspect Deliverect payload(s) for an order.
 * GET /api/dev/orders/[orderId]/deliverect-payload
 * Returns generated payload per vendor order for validation (no API submission).
 */
import { NextResponse } from "next/server";
import { getOrderVendorOrdersForDeliverect } from "@/integrations/deliverect/load";
import { mennyuVendorOrderToDeliverectPayload } from "@/integrations/deliverect/transform";

export async function GET(
  _request: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { orderId } = await context.params;
  const vendorOrders = await getOrderVendorOrdersForDeliverect(orderId);
  if (vendorOrders.length === 0) {
    return NextResponse.json(
      { error: "Order not found or has no vendor orders", orderId },
      { status: 404 }
    );
  }

  const results = vendorOrders.map((vo) => {
    const channelLinkId =
      vo.vendor.deliverectChannelLinkId ?? vo.deliverectChannelLinkId ?? "__placeholder_channel__";
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: vo,
      channelLinkId,
      locationId: vo.vendor.deliverectLocationId ?? undefined,
      customerPhone: vo.order.customerPhone,
      customerEmail: vo.order.customerEmail ?? null,
      preparationTimeMinutes: 15,
    });
    return {
      vendorOrderId: vo.id,
      vendorName: vo.vendor.name,
      payload,
    };
  });

  return NextResponse.json({
    orderId,
    vendorOrders: results,
  });
}
