import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getResumePaymentPayloadForCustomer } from "@/services/payment.service";
import { OrderResumePaymentClient } from "./OrderResumePaymentClient";

/**
 * Unpaid checkout: not the normal post-purchase order status UI. Customer must complete Stripe (or dev bypass).
 * Access is enforced by the parent order page before this component renders.
 */
export async function OrderResumePayment({ orderId }: { orderId: string }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { customerPhone: true, status: true, totalCents: true },
  });

  if (!order) notFound();

  if (order.status !== "pending_payment") {
    redirect(`/order/${orderId}`);
  }

  const payload = await getResumePaymentPayloadForCustomer({
    orderId,
    customerPhone: order.customerPhone.trim(),
  });
  if (!payload) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-semibold text-stone-900">Complete payment</h1>
      <p className="mt-2 text-stone-600">
        Your order is reserved. Pay below to send it to the vendors. Nothing is charged until you finish here.
      </p>
      <p className="mt-1 text-sm text-stone-500">
        Total due: <span className="font-semibold tabular-nums text-stone-800">${(payload.totalCents / 100).toFixed(2)}</span>
      </p>
      <OrderResumePaymentClient
        orderId={orderId}
        clientSecret={payload.clientSecret}
        paymentIntentId={payload.paymentIntentId}
        totalCents={payload.totalCents}
      />
      <Link
        href="/cart"
        className="mt-6 inline-block text-sm font-medium text-stone-600 hover:text-stone-900"
      >
        Back to cart
      </Link>
    </div>
  );
}
