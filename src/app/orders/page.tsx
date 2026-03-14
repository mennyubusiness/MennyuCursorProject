import Link from "next/link";
import { headers } from "next/headers";
import { getCustomerPhoneFromHeaders } from "@/lib/session";
import { getOrdersByCustomerPhoneAction } from "@/actions/order.actions";
import { parentStatusLabel } from "@/domain/order-state";
import { OrderHistoryPhoneForm } from "./OrderHistoryPhoneForm";
import { ReorderButton } from "./ReorderButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function OrdersPage() {
  const headersList = await headers();
  const customerPhone = getCustomerPhoneFromHeaders(headersList);

  if (!customerPhone) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <h1 className="text-xl font-semibold text-stone-900">Order history</h1>
        <OrderHistoryPhoneForm />
        <p className="text-sm text-stone-500">
          <Link href="/explore" className="text-mennyu-primary hover:underline">
            ← Back to explore
          </Link>
        </p>
      </div>
    );
  }

  const orders = await getOrdersByCustomerPhoneAction(customerPhone);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold text-stone-900">Order history</h1>
      <p className="text-sm text-stone-600">
        Orders for {customerPhone.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")}
      </p>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
          <p className="text-stone-600">No orders yet.</p>
          <p className="mt-1 text-sm text-stone-500">Place an order from a pod to see it here.</p>
          <Link href="/explore" className="mt-4 inline-block text-mennyu-primary hover:underline">
            Browse pods →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-stone-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm text-stone-500">
                  Order #{order.id.slice(-8).toUpperCase()}
                </p>
                <p className="mt-1 text-sm text-stone-600">{formatDate(order.createdAt)}</p>
                <p className="mt-0.5 text-sm text-stone-700">{order.podName}</p>
                <p className="text-xs text-stone-500">
                  {order.vendorNames.join(", ")}
                </p>
                <p className="mt-1 font-medium text-stone-900">
                  ${(order.totalCents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-stone-600">
                  {parentStatusLabel(order.status as Parameters<typeof parentStatusLabel>[0])}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/order/${order.id}`}
                  className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
                >
                  View details
                </Link>
                <ReorderButton orderId={order.id} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-stone-500">
        <Link href="/explore" className="text-mennyu-primary hover:underline">
          ← Back to explore
        </Link>
      </p>
    </div>
  );
}
