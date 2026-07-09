import { NextResponse } from "next/server";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { fetchAdminOrderDetail } from "@/lib/admin-order-detail-query";
import { loadSquareOrderRoutingDebug } from "@/lib/integrations/square/square-order-routing-debug.server";
import { isSquareRoutedVendorOrder } from "@/lib/admin-order-detail-ui";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  if (!(await isAdminDashboardLayoutAuthorized())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await params;
  const order = await fetchAdminOrderDetail(orderId);
  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const squareVendorOrders = order.vendorOrders.filter((vo) => isSquareRoutedVendorOrder(vo));
  const debug = await Promise.all(
    squareVendorOrders.map((vo) =>
      loadSquareOrderRoutingDebug({
        vendorOrderId: vo.id,
        vendorId: vo.vendorId,
        orderRoutingMode: vo.vendor.orderRoutingMode,
        routingStatus: vo.routingStatus,
        squareOrderId: vo.squareOrderId,
        squareSubmittedAt: vo.squareSubmittedAt,
        squareAttempts: vo.squareAttempts,
        squareLastError: vo.squareLastError,
        lastSquarePayload: vo.lastSquarePayload,
        lastSquareResponse: vo.lastSquareResponse,
        orderStatus: order.status,
        fulfillmentStatus: vo.fulfillmentStatus,
        manuallyRecoveredAt: vo.manuallyRecoveredAt,
      })
    )
  );

  return NextResponse.json({
    orderId: order.id,
    orderStatus: order.status,
    squareVendorOrders: debug.filter(Boolean),
  });
}
