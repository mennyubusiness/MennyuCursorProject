import Link from "next/link";
import { DashboardCard } from "@/components/dashboard";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export function VendorSquareSetupSummary({
  vendorId,
  orderRoutingMode,
  squareConnectionReady,
  squareRoutingOperational,
}: {
  vendorId: string;
  orderRoutingMode: string | null | undefined;
  squareConnectionReady: boolean;
  squareRoutingOperational?: boolean;
}) {
  if (!isSquareRoutingMode(orderRoutingMode)) return null;

  const integrationsHref = `/vendor/${vendorId}/integrations/square`;

  return (
    <DashboardCard className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-oo-charcoal">Square integration</h3>
          <p className="mt-1 text-sm text-oo-charcoal">
            Square connection:{" "}
            <span className={squareConnectionReady ? "text-emerald-800" : "text-amber-900"}>
              {squareConnectionReady ? "Connected" : "Needs attention"}
            </span>
          </p>
          {squareRoutingOperational ? (
            <p className="mt-2 text-xs text-emerald-900">
              Square routing is ready. Paid Open Order orders will be sent to Square as prepaid pickup orders.
            </p>
          ) : null}
          {!squareConnectionReady ? (
            <p className="mt-2 text-xs text-oo-stone-gray">
              Square routing is selected. Connect Square and select a location to finish setup.
            </p>
          ) : !squareRoutingOperational ? (
            <p className="mt-2 text-xs text-oo-stone-gray">
              Square routing is selected. Import and publish a Square menu before orders can be sent to Square.
            </p>
          ) : null}
        </div>
        <Link
          href={integrationsHref}
          className="inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          Manage Square integration
        </Link>
      </div>
    </DashboardCard>
  );
}
