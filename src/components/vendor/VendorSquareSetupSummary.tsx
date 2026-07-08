import Link from "next/link";
import { DashboardCard } from "@/components/dashboard";
import { isSquareRoutingMode } from "@/lib/vendor-order-routing-mode";

export function VendorSquareSetupSummary({
  vendorId,
  orderRoutingMode,
  squareConnectionReady,
  squareOrderRoutingEnabled,
}: {
  vendorId: string;
  orderRoutingMode: string | null | undefined;
  squareConnectionReady: boolean;
  squareOrderRoutingEnabled: boolean;
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
          {squareConnectionReady && !squareOrderRoutingEnabled ? (
            <p className="mt-2 text-xs text-oo-stone-gray">
              Square is connected. Square order routing is pending Open Order admin enablement.
            </p>
          ) : null}
          {!squareConnectionReady ? (
            <p className="mt-2 text-xs text-oo-stone-gray">
              Connect Square and select a location to finish order routing setup.
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
