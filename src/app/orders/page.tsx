import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOrdersForSignedInUserAction } from "@/actions/order.actions";
import { ORDERS_SIGN_IN_PATH } from "@/lib/auth/account-paths";
import { customerOrderHeaderStatus } from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import { ReorderButton } from "@/components/orders/ReorderButton";

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Stub rows so {@link customerOrderHeaderStatus} can branch on multi-vendor (e.g. routed_partial). */
function stubVendorOrders(count: number): Array<{ routingStatus: string; fulfillmentStatus: string }> {
  return Array.from({ length: Math.max(1, count) }, () => ({
    routingStatus: "sent",
    fulfillmentStatus: "pending",
  }));
}

export default async function OrdersPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(ORDERS_SIGN_IN_PATH);
  }

  const history = await getOrdersForSignedInUserAction();
  const orders = history.ok ? history.orders : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-stone-900">Order history</h1>
        <p className="text-sm text-stone-600">
          Signed in as <span className="font-medium text-stone-800">{session.user.email}</span>
        </p>
      </header>

      {!history.ok && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {history.error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-6 text-center">
          <p className="text-stone-600">No orders on this account yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            Orders placed while signed in will appear here. Phone-only checkout orders stay accessible
            from your SMS link until linked to this account.
          </p>
          <Link href="/explore" className="mt-4 inline-block text-stone-900 hover:underline">
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
        <Link href="/explore" className="text-stone-900 hover:underline">
          ← Back to explore
        </Link>
      </p>
    </div>
  );
}
