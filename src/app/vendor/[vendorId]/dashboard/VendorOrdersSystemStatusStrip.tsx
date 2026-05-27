import Link from "next/link";

type Props = {
  vendorId: string;
  posConnected: boolean;
  payoutsReady: boolean;
  ordersPaused: boolean;
};

const linkClass =
  "rounded-md px-2 py-1 text-left text-oo-charcoal transition hover:bg-oo-cream hover:text-oo-charcoal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400";

export function VendorOrdersSystemStatusStrip({ vendorId, posConnected, payoutsReady, ordersPaused }: Props) {
  const settings = `/vendor/${vendorId}/settings`;

  return (
    <nav
      aria-label="System status"
      className="flex flex-wrap items-center justify-end gap-x-1 gap-y-2 text-sm text-oo-stone-gray"
    >
      <Link href={`${settings}#vendor-settings-pos`} className={linkClass}>
        <span className="text-oo-stone-gray">POS</span>
        <span className={posConnected ? " font-medium text-emerald-800" : " font-medium text-oo-charcoal"}>
          {" "}
          · {posConnected ? "Connected" : "Not connected"}
        </span>
      </Link>
      <span className="hidden text-stone-300 sm:inline" aria-hidden>
        |
      </span>
      <Link href={`${settings}#vendor-settings-payouts`} className={linkClass}>
        <span className="text-oo-stone-gray">Payouts</span>
        <span className={payoutsReady ? " font-medium text-emerald-800" : " font-medium text-oo-charcoal"}>
          {" "}
          · {payoutsReady ? "Ready" : "Not set up"}
        </span>
      </Link>
      <span className="hidden text-stone-300 sm:inline" aria-hidden>
        |
      </span>
      <Link href={`${settings}#vendor-settings-ordering`} className={linkClass}>
        <span className="text-oo-stone-gray">Orders</span>
        <span className={ordersPaused ? " font-medium text-amber-900" : " font-medium text-emerald-800"}>
          {" "}
          · {ordersPaused ? "Paused" : "Live"}
        </span>
      </Link>
    </nav>
  );
}
