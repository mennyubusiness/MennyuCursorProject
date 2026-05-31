import Link from "next/link";

import { customerOrderHeaderStatus } from "@/domain/order-state";
import type { ParentOrderStatus } from "@/domain/types";
import type { OrderHistoryEntry } from "@/services/customer-account-orders.service";
import { ORDER_HISTORY_PATH } from "@/lib/auth/account-paths";
import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";

function formatOrderDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}

function stubVendorOrders(count: number): Array<{ routingStatus: string; fulfillmentStatus: string }> {
  return Array.from({ length: Math.max(1, count) }, () => ({
    routingStatus: "sent",
    fulfillmentStatus: "pending",
  }));
}

type AccountRecentOrdersProps = {
  orders: OrderHistoryEntry[];
  showPhoneLinkHint: boolean;
};

export function AccountRecentOrders({ orders, showPhoneLinkHint }: AccountRecentOrdersProps) {
  return (
    <section className={accountHubCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={accountHubSectionTitleClass}>Recent orders</h2>
          <p className={`mt-1 ${accountHubMutedClass}`}>Your latest orders on this account.</p>
        </div>
        {orders.length > 0 && (
          <Link
            href={ORDER_HISTORY_PATH}
            className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
          >
            View all →
          </Link>
        )}
      </div>

      {orders.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-oo-light-stone bg-oo-cream/60 px-4 py-8 text-center">
          <p className="text-sm font-medium text-oo-charcoal">No orders yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-oo-stone-gray">
            Orders placed while signed in appear here automatically.
            {showPhoneLinkHint
              ? " Link your checkout phone above to include phone checkout orders."
              : " Placed an order with phone checkout? Link your phone above to add those orders."}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/explore"
              className="rounded-lg bg-oo-charcoal px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              Browse pods
            </Link>
            <Link
              href={ORDER_HISTORY_PATH}
              className="text-sm font-semibold text-brand underline-offset-4 hover:underline"
            >
              Order history
            </Link>
          </div>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-lg border border-oo-light-stone bg-oo-cream/40 p-4 transition hover:border-oo-stone-gray/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-oo-charcoal">{order.podName}</p>
                  <p className="mt-0.5 text-xs text-oo-stone-gray">{formatOrderDate(order.createdAt)}</p>
                  <p className="mt-1 text-xs text-oo-stone-gray">{order.vendorNames.join(", ")}</p>
                  <p className="mt-2 text-sm font-semibold text-oo-charcoal">
                    ${(order.totalCents / 100).toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-xs text-oo-stone-gray">
                    {customerOrderHeaderStatus(
                      order.status as ParentOrderStatus,
                      stubVendorOrders(order.vendorNames.length)
                    )}
                  </p>
                </div>
                <Link
                  href={`/order/${order.id}`}
                  className="shrink-0 rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-sm font-medium text-oo-charcoal hover:bg-white"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
