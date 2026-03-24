import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { getResumePaymentPayloadForCustomer } from "@/services/payment.service";
import { SetCustomerPhoneFromOrder } from "./SetCustomerPhoneFromOrder";
import { PhoneCookieSyncRefresh } from "./PhoneCookieSyncRefresh";
import { OrderResumePaymentClient } from "./OrderResumePaymentClient";

/**
 * Unpaid checkout: not the normal post-purchase order status UI. Customer must complete Stripe (or dev bypass).
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

  const headersList = await headers();
  const cookiePhone = getCustomerPhoneFromHeaders(headersList)?.trim() ?? "";
  const orderPhone = order.customerPhone.trim();

  if (!cookiePhone) {
    return (
      <div className="mx-auto max-w-lg">
        <SetCustomerPhoneFromOrder customerPhone={order.customerPhone} />
        <PhoneCookieSyncRefresh />
        <h1 className="text-2xl font-semibold text-stone-900">Resume payment</h1>
        <p className="mt-3 text-stone-600">
          Hang on — we&apos;re confirming this device matches your order so you can pay safely.
        </p>
        <p className="mt-2 text-sm text-stone-500">
          This page usually refreshes on its own. If it doesn&apos;t, open the link again from the same phone you used to
          start checkout, or return to your cart.
        </p>
        <Link
          href="/cart"
          className="mt-6 inline-block rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          Back to cart
        </Link>
      </div>
    );
  }

  if (cookiePhone !== orderPhone) {
    return (
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold text-stone-900">Resume payment</h1>
        <p className="mt-3 text-stone-600">
          This order was placed with a different phone number than the one saved on this device.
        </p>
        <Link
          href="/cart"
          className="mt-6 inline-block rounded-lg bg-mennyu-primary px-4 py-2 text-sm font-semibold text-black hover:bg-mennyu-secondary"
        >
          Back to cart
        </Link>
      </div>
    );
  }

  const payload = await getResumePaymentPayloadForCustomer({
    orderId,
    customerPhone: cookiePhone,
  });
  if (!payload) notFound();

  return (
    <div className="mx-auto max-w-lg">
      <SetCustomerPhoneFromOrder customerPhone={order.customerPhone} />
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
    </div>
  );
}
