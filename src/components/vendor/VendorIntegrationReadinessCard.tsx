import { DashboardCard } from "@/components/dashboard";
import type { VendorIntegrationObservability } from "@/lib/integrations/provider-observability.service";

function statusBadgeClass(ready: boolean): string {
  return ready
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-amber-50 text-amber-900 border-amber-200";
}

export function VendorIntegrationReadinessCard({
  observability,
}: {
  observability: VendorIntegrationObservability;
}) {
  const { readiness, connections, mappingHealth, squareHealth } = observability;

  return (
    <DashboardCard className="max-w-3xl">
      <h3 className="text-sm font-semibold text-oo-charcoal">Integration readiness</h3>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Normalized provider health — existing setup checklist remains authoritative.
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
            {squareHealth.missingRequirements.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-xs text-oo-stone-gray">
                {squareHealth.missingRequirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>

      {connections.length > 0 ? (
        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Connection records
          </h4>
          <ul className="mt-2 space-y-2 text-xs text-oo-charcoal">
            {connections.map((c) => (
              <li key={c.id} className="rounded border border-oo-light-stone px-2 py-1.5">
                <span className="font-medium">{c.providerLabel}</span>
                <span className="text-oo-stone-gray"> — {c.status}</span>
                {c.externalLocationId ? (
                  <span className="block font-mono text-[11px] text-oo-stone-gray">
                    Location: {c.externalLocationId}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Object.keys(mappingHealth).length > 0 ? (
        <div className="mt-4 text-xs text-oo-stone-gray">
          {Object.entries(mappingHealth).map(([provider, health]) =>
            health ? (
              <p key={provider}>
                {provider} mappings: {health.activeMappings} active
                {!health.isHealthy ? " — needs attention" : ""}
              </p>
            ) : null
          )}
        </div>
      ) : null}
    </DashboardCard>
  );
}
