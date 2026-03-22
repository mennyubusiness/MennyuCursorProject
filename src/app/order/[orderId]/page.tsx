import { notFound } from "next/navigation";
import {
  getOrderStatusAction,
  reconcilePaymentIfSucceededAction,
  clearCartAfterOrderSuccessAction,
} from "@/actions/order.actions";
import { OrderPageContent } from "./OrderPageContent";

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string; payment?: string }>;
}) {
  const { orderId } = await params;
  const { from, payment } = await searchParams;

  let order = await getOrderStatusAction(orderId);
  if (!order) notFound();

  if (payment === "success" && order.status === "pending_payment") {
    await reconcilePaymentIfSucceededAction(orderId);
    order = (await getOrderStatusAction(orderId)) ?? order;
  }

  if (payment === "success" && order.status !== "pending_payment") {
    await clearCartAfterOrderSuccessAction(orderId);
  }

  return (
    <OrderPageContent
      key={orderId}
      initialOrder={order}
      orderId={orderId}
      from={from}
    />
  );
}
