import { notFound, redirect } from "next/navigation";
import {
  getOrderStatusAction,
  reconcilePaymentIfSucceededAction,
  clearCartAfterOrderSuccessAction,
} from "@/actions/order.actions";
import { OrderPageContent } from "./OrderPageContent";
import { OrderResumePayment } from "./OrderResumePayment";

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
    // TEMP DEBUG: remove after production checkout investigation
    console.info("[mennyu:checkout-debug] order page payment=success + pending_payment; reconciling", {
      orderId,
    });
    await reconcilePaymentIfSucceededAction(orderId);
    order = (await getOrderStatusAction(orderId)) ?? order;
    console.info("[mennyu:checkout-debug] order page after reconcile", {
      orderId,
      status: order.status,
    });
  }

  if (payment === "success" && order.status !== "pending_payment") {
    await clearCartAfterOrderSuccessAction(orderId);
    // Strip Stripe return query params (client_secret, etc.) from the URL to avoid leaking secrets
    // and to reduce odd interactions with Stripe.js if the user refreshes.
    const qs = from ? `?from=${encodeURIComponent(from)}` : "";
    redirect(`/order/${orderId}${qs}`);
  }

  if (order.status === "pending_payment") {
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
