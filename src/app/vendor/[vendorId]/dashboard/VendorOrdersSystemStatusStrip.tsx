import Link from "next/link";

import { DashboardStatusBadge } from "@/components/dashboard";

type Props = {
  vendorId: string;
  posConnected: boolean;
  paymentsReady: boolean;
  ordersPaused: boolean;
};

const linkClass =
  "inline-flex items-center gap-2 rounded-md px-1 py-1 text-sm text-oo-charcoal transition hover:bg-oo-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400";

export function VendorOrdersSystemStatusStrip({
  vendorId,
  posConnected,
  paymentsReady,
  ordersPaused,
}: Props) {
  return (
    <nav aria-label="System status" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
      <Link href={`/vendor/${vendorId}/setup`} className={linkClass}>
        <span className="text-oo-stone-gray">POS</span>
        <DashboardStatusBadge tone={posConnected ? "success" : "neutral"}>
          {posConnected ? "Connected" : "Not connected"}
        </DashboardStatusBadge>
      </Link>
      <Link href={`/vendor/${vendorId}/payouts`} className={linkClass}>
        <span className="text-oo-stone-gray">Payments</span>
        <DashboardStatusBadge tone={paymentsReady ? "success" : "warning"}>
          {paymentsReady ? "Ready" : "Needs setup"}
        </DashboardStatusBadge>
      </Link>
      <Link href={`/vendor/${vendorId}/hours`} className={linkClass}>
        <span className="text-oo-stone-gray">Orders</span>
        <DashboardStatusBadge tone={ordersPaused ? "warning" : "success"}>
          {ordersPaused ? "Paused" : "Accepting orders"}
        </DashboardStatusBadge>
      </Link>
    </nav>
  );
}
