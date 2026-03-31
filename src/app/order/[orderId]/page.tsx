import { notFound, redirect } from "next/navigation";
import {
  getOrderStatusAction,
  reconcilePaymentIfSucceededAction,
  clearCartAfterOrderSuccessAction,
} from "@/actions/order.actions";
import { OrderPageContent } from "./OrderPageContent";
import { OrderPaymentConfirming } from "./OrderPaymentConfirming";
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
    const reconcileResult = await reconcilePaymentIfSucceededAction(orderId);
    // TEMP DEBUG: remove after post-payment flow verification
    console.info("[mennyu:post-payment-debug] reconcile after Stripe return", {
      orderId,
      reconciled: reconcileResult.reconciled,
      error: reconcileResult.error,
    });
    order = (await getOrderStatusAction(orderId)) ?? order;
    console.info("[mennyu:post-payment-debug] order status after reconcile + refetch", {
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
    /** Stripe already redirected with success, but DB still pending — do not show pay-again UI; poll until paid. */
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
