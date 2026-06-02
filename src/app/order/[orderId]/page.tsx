import { notFound, redirect } from "next/navigation";
import {
  getOrderStatusAction,
  reconcilePaymentIfSucceededAction,
} from "@/actions/order.actions";
import { assertCustomerOrderAccess } from "@/lib/customer-order-access";
import { OrderPageContent } from "./OrderPageContent";
import { OrderPaymentConfirming } from "./OrderPaymentConfirming";
import { OrderResumePayment } from "./OrderResumePayment";
import { OrderAccessDenied } from "./OrderAccessDenied";

export default async function OrderStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ from?: string; payment?: string; access?: string }>;
}) {
  const { orderId } = await params;
  const { from, payment, access } = await searchParams;

  if (access?.trim()) {
    const bootstrapParams = new URLSearchParams({ access: access.trim() });
    if (from) bootstrapParams.set("from", from);
    if (payment) bootstrapParams.set("payment", payment);
    redirect(`/api/orders/${orderId}/access?${bootstrapParams.toString()}`);
  }

  const accessCheck = await assertCustomerOrderAccess(orderId);
  if (!accessCheck.ok) {
    return <OrderAccessDenied status={accessCheck.status} message={accessCheck.error} />;
  }

  let order = await getOrderStatusAction(orderId);
  if (!order) notFound();

  if (payment === "success" && order.status === "pending_payment") {
    await reconcilePaymentIfSucceededAction(orderId);
    order = (await getOrderStatusAction(orderId)) ?? order;
  }

  if (payment === "success" && order.status !== "pending_payment") {
    const qs = from ? `?from=${encodeURIComponent(from)}` : "";
    redirect(`/order/${orderId}${qs}`);
  }

  if (order.status === "pending_payment") {
    if (payment === "success") {
      return <OrderPaymentConfirming orderId={orderId} />;
    }
    return <OrderResumePayment orderId={orderId} />;
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
