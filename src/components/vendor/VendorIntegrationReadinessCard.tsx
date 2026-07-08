import { DashboardCard } from "@/components/dashboard";
import type { VendorIntegrationObservability } from "@/lib/integrations/provider-observability.service";
import { filterSquareVendorFacingWarnings } from "@/lib/integrations/square/square-vendor-facing-health";

function statusBadgeClass(ready: boolean): string {
  return ready
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-amber-50 text-amber-900 border-amber-200";
}

export function VendorIntegrationReadinessCard({
  observability,
  squareOrderRoutingEnabled = false,
}: {
  observability: VendorIntegrationObservability;
  squareOrderRoutingEnabled?: boolean;
}) {
  const { readiness, squareHealth } = observability;

  const squareMissing = squareHealth
    ? filterSquareVendorFacingWarnings(squareHealth.missingRequirements)
    : [];

  return (
    <DashboardCard className="max-w-3xl">
      <h3 className="text-sm font-semibold text-oo-charcoal">Integration readiness</h3>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Summary of your order routing and menu integrations.
      </p>

      <div className="mt-4 space-y-3">
        {readiness.orderRouting ? (
          <div className="rounded-lg border border-oo-light-stone px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-oo-charcoal">
                {readiness.labels.orderRouting}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(readiness.orderRouting.health.isReady)}`}
              >
                {readiness.orderRouting.health.isReady ? "Ready" : "Not ready"}
              </span>
            </div>
            {readiness.orderRouting.health.missingRequirements.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-oo-stone-gray">
                {readiness.orderRouting.health.missingRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {readiness.menuSource ? (
          <div className="rounded-lg border border-oo-light-stone px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-oo-charcoal">
                {readiness.labels.menuSource}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(readiness.menuSource.health.isReady)}`}
              >
                {readiness.menuSource.health.isReady ? "Ready" : "Not ready"}
              </span>
            </div>
            {readiness.menuSource.health.missingRequirements.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-oo-stone-gray">
                {readiness.menuSource.health.missingRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {squareHealth ? (
          <div className="rounded-lg border border-oo-light-stone px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-oo-charcoal">Square connection</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(squareHealth.isReady)}`}
              >
                {squareHealth.isReady
                  ? "Connected"
                  : squareHealth.status === "not_configured"
                    ? "Not connected"
                    : "Needs attention"}
              </span>
            </div>
            {squareMissing.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-oo-stone-gray">
                {squareMissing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            {squareHealth.isReady && !squareOrderRoutingEnabled ? (
              <p className="mt-2 text-xs text-oo-stone-gray">
                Square order routing is pending Open Order admin enablement.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </DashboardCard>
  );
}
