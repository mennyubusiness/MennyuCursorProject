import Link from "next/link";
import { DashboardCard } from "@/components/dashboard";
import type {
  VendorSetupIntegrationCardView,
  VendorSetupIntegrationsViewModel,
  VendorSetupIntegrationStatus,
  VendorIntegrationsSurface,
} from "@/lib/vendor-setup-integrations";

function statusBadgeClass(status: VendorSetupIntegrationStatus): string {
  switch (status) {
    case "ready":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "needs_attention":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "available":
      return "border-oo-light-stone bg-oo-cream/60 text-oo-charcoal";
    case "not_configured":
      return "border-oo-light-stone bg-oo-warm-white text-oo-stone-gray";
  }
}

function IntegrationCard({ card }: { card: VendorSetupIntegrationCardView }) {
  const showBlockers = card.status === "needs_attention" && card.blockers.length > 0;

  return (
    <div className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-oo-charcoal">{card.title}</h4>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusBadgeClass(card.status)}`}
            >
              {card.statusLabel}
            </span>
          </div>
          <p className="mt-2 text-xs text-oo-stone-gray">{card.copy}</p>
          {showBlockers ? (
            <ul className="mt-2 list-inside list-disc text-xs text-oo-stone-gray">
              {card.blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </div>
        {card.actions.length > 0 ? (
          <div className="flex shrink-0 flex-col gap-2">
            {card.actions.map((action) => (
              <Link
                key={`${card.id}-${action.href}`}
                href={action.href}
                className="inline-flex items-center justify-center rounded-lg border border-oo-light-stone bg-oo-cream px-3 py-2 text-xs font-semibold text-oo-charcoal hover:bg-oo-warm-white"
              >
                {action.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function availableIntegrationsCopy(surface: VendorIntegrationsSurface): string {
  if (surface === "hub") {
    return "Optional providers that are not connected yet. These do not block your active routing.";
  }
  return "Optional providers that are not your active routing mode. These do not block setup.";
}

export function VendorIntegrationsSection({
  model,
  surface = "setup",
  showHeading = true,
}: {
  model: VendorSetupIntegrationsViewModel;
  surface?: VendorIntegrationsSurface;
  showHeading?: boolean;
}) {
  const inactiveCards =
    surface === "setup"
      ? [...model.connectedIntegrations, ...model.availableIntegrations]
      : model.availableIntegrations;

  return (
    <section id="integrations" className="max-w-3xl space-y-4">
      {showHeading ? (
        <div>
          <h3 className="text-sm font-semibold text-oo-charcoal">Integrations</h3>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Manage how this vendor receives orders and keeps menus in sync.
          </p>
        </div>
      ) : null}

      <DashboardCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Active order routing
        </p>
        <IntegrationCard card={model.activeRouting} />
      </DashboardCard>

      <DashboardCard className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Active menu source
        </p>
        <IntegrationCard card={model.activeMenuSource} />
      </DashboardCard>

      {surface === "hub" && model.connectedIntegrations.length > 0 ? (
        <DashboardCard className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Connected integrations
          </p>
          <div className="space-y-3">
            {model.connectedIntegrations.map((card) => (
              <IntegrationCard key={card.id} card={card} />
            ))}
          </div>
        </DashboardCard>
      ) : null}

      {inactiveCards.length > 0 ? (
        <details className="rounded-xl border border-oo-light-stone bg-oo-cream/40 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-oo-charcoal">
            Available integrations
          </summary>
          <p className="mt-1 text-xs text-oo-stone-gray">{availableIntegrationsCopy(surface)}</p>
          <div className="mt-4 space-y-3">
            {inactiveCards.map((card) => (
              <IntegrationCard key={card.id} card={card} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}

/** @deprecated Use VendorIntegrationsSection */
export const VendorSetupIntegrationsSection = VendorIntegrationsSection;
