import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getOrdersForSignedInUserAction } from "@/actions/order.actions";
import { ACCOUNT_HUB_PATH, ORDERS_SIGN_IN_PATH } from "@/lib/auth/account-paths";
import { customerOrderHeaderStatus } from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import { ReorderButton } from "@/components/orders/ReorderButton";
import {
  DashboardCard,
  DashboardEmptyState,
  DashboardPageHeader,
} from "@/components/dashboard";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
    <div className="space-y-6">
      <DashboardPageHeader
        headingLevel={1}
        title="Order history"
        description={`Signed in as ${session.user.email}`}
      />

      {!history.ok && (
        <DashboardCard variant="warning">
          <p className="text-sm text-amber-950">{history.error}</p>
        </DashboardCard>
      )}

      {orders.length === 0 ? (
        <DashboardEmptyState
          title="No orders on this account yet"
          description="Orders placed while signed in appear here automatically. Placed an order with phone checkout? Go to Account and link your phone to include those orders."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <Link href={ACCOUNT_HUB_PATH} className={cn(buttonClassName({ variant: "primary", size: "sm" }))}>
                Go to account
              </Link>
              <Link
                href="/explore"
                className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
              >
                Browse pods →
              </Link>
            </div>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <DashboardCard>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-oo-stone-gray">
                      Order #{order.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="mt-1 text-sm text-oo-stone-gray">{formatDate(order.createdAt)}</p>
                    <p className="mt-0.5 text-sm text-oo-charcoal">{order.podName}</p>
                    <p className="text-xs text-oo-stone-gray">{order.pickupDisplayLine}</p>
                    <p className="text-xs text-oo-stone-gray">{order.vendorNames.join(", ")}</p>
                    <p className="mt-1 font-medium text-oo-charcoal">
                      ${(order.totalCents / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-oo-stone-gray">
                      {customerOrderHeaderStatus(
                        order.status as ParentOrderStatus,
                        stubVendorOrders(order.vendorNames.length)
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      href={`/order/${order.id}`}
                      className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
                    >
                      View details
                    </Link>
                    <ReorderButton orderId={order.id} />
                  </div>
                </div>
              </DashboardCard>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-oo-stone-gray">
        <Link href="/explore" className="font-medium text-oo-charcoal hover:underline">
          ← Back to explore
        </Link>
      </p>
    </div>
  );
}
