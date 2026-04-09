import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { resolveCustomerPhoneForSession } from "@/lib/customer-phone-resolution";
import { getOrdersByCustomerPhoneAction } from "@/actions/order.actions";
import { customerOrderHeaderStatus } from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import { ClearPhoneSessionButton } from "./ClearPhoneSessionButton";
import { OrderHistoryPhoneForm } from "./OrderHistoryPhoneForm";
import { ReorderButton } from "@/components/orders/ReorderButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function formatUsPhone(phone: string): string {
  const m = phone.replace(/\D/g, "").match(/^(\d{3})(\d{3})(\d{4})$/);
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`;
  return phone;
}

/** Stub rows so {@link customerOrderHeaderStatus} can branch on multi-vendor (e.g. routed_partial). */
function stubVendorOrders(count: number): Array<{ routingStatus: string; fulfillmentStatus: string }> {
  return Array.from({ length: Math.max(1, count) }, () => ({
    routingStatus: "sent",
    fulfillmentStatus: "pending",
  }));
}

export default async function OrdersPage() {
  const headersList = await headers();
  const session = await auth();
  const customerPhone = await resolveCustomerPhoneForSession(headersList, session?.user?.id ?? null);
  const sessionEmail = session?.user?.email ?? null;

  if (!customerPhone) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-stone-900">Your orders</h1>
          <p className="text-sm text-stone-600">
            This is where you view past orders. Mennyu matches them to the{" "}
            <span className="font-medium text-stone-800">phone number</span> you used at checkout
            (not your email address yet).
          </p>
          {sessionEmail && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
              You’re signed in as <span className="font-medium">{sessionEmail}</span> (for vendor or
              staff tools if you have access). To see your personal orders, enter the phone number
              you gave when placing an order.
            </p>
          )}
        </header>
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
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900">Your orders</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p className="text-sm text-stone-600">
            Showing orders for{" "}
            <span className="font-medium text-stone-800">{formatUsPhone(customerPhone)}</span>
          </p>
          <ClearPhoneSessionButton />
        </div>
        {sessionEmail && (
          <p className="text-xs text-stone-500">
            Signed in as {sessionEmail}. Order history is still linked to your phone number above.
          </p>
        )}
      </header>

      {orders.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
          <p className="text-stone-600">No orders yet for this phone number.</p>
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
                <p className="text-xs text-stone-600">{order.pickupDisplayLine}</p>
                <p className="text-xs text-stone-500">{order.vendorNames.join(", ")}</p>
                <p className="mt-1 font-medium text-stone-900">
                  ${(order.totalCents / 100).toFixed(2)}
                </p>
                <p className="text-xs text-stone-600">
                  {customerOrderHeaderStatus(order.status as ParentOrderStatus, stubVendorOrders(order.vendorNames.length))}
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
