import type { VendorOrderRoutingMode } from "@prisma/client";
import {
  isDeliverectRoutingMode,
  vendorOrderRoutingModeShortLabel,
} from "@/lib/vendor-order-routing-mode";
import type { ReadinessOwner, VendorPodReadinessStatus } from "@/lib/vendor-pod-readiness";
import { podOwnerVendorDisplayStatus } from "@/lib/pod-vendor-adoption";

export type PodRosterReadinessSnapshot = {
  status: VendorPodReadinessStatus;
  label: string;
  description: string;
  canAcceptOrders: boolean;
  /** Durable menu-only intent — distinct from an unfinished ordering setup. */
  menuOnly?: boolean;
  menuOnlyByPod?: boolean;
  orderRoutingMode?: VendorOrderRoutingMode;
  setupSummary: {
    profile: boolean;
    publicProfile?: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
    hours?: boolean;
  };
  primaryBlocker: {
    code: string;
    label: string;
    description: string;
    owner: ReadinessOwner;
  } | null;
};

function SetupFlag({ label, complete }: { label: string; complete: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${
        complete ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"
      }`}
      title={complete ? `${label}: complete` : `${label}: needs attention`}
    >
      <span aria-hidden>{complete ? "✓" : "·"}</span>
      {label}
    </span>
  );
}

function ownerHint(owner: ReadinessOwner): string {
  if (owner === "vendor") return "Vendor action";
  if (owner === "open_order") return "Open Order";
  return "Your action";
}

export function PodRosterReadinessSummary({
  readiness,
  orderRoutingMode,
}: {
  readiness: PodRosterReadinessSnapshot;
  orderRoutingMode?: VendorOrderRoutingMode;
}) {
  const mode = orderRoutingMode ?? readiness.orderRoutingMode;
  const menuOnly = Boolean(readiness.menuOnly);
  const routingLabel = mode && !menuOnly ? vendorOrderRoutingModeShortLabel(mode) : null;
  const routingIncomplete =
    mode && isDeliverectRoutingMode(mode) && !readiness.canAcceptOrders && readiness.setupSummary.pos === false;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        <SetupFlag label="Profile" complete={readiness.setupSummary.profile} />
        {/* Stripe and routing are only requirements when this vendor is meant to take orders. */}
        {menuOnly ? null : <SetupFlag label="Stripe" complete={readiness.setupSummary.stripe} />}
        {menuOnly ? null : mode && isDeliverectRoutingMode(mode) ? (
          <SetupFlag label="Deliverect" complete={readiness.setupSummary.pos} />
        ) : (
          <SetupFlag label="Dashboard" complete={true} />
        )}
        <SetupFlag label="Menu" complete={readiness.setupSummary.menu} />
      </div>
      {routingLabel ? (
        <p className="text-[11px] text-oo-stone-gray">
          Routing: <span className="font-medium text-oo-charcoal">{routingLabel}</span>
          {routingIncomplete ? " · setup incomplete" : null}
        </p>
      ) : null}
      <p className="text-xs text-oo-stone-gray">
        <span className="font-medium text-oo-charcoal">
          {podOwnerVendorDisplayStatus(
            readiness.status,
            readiness.canAcceptOrders,
            readiness.setupSummary,
            { menuOnly, menuOnlyByPod: Boolean(readiness.menuOnlyByPod) }
          )}
        </span>
        {readiness.canAcceptOrders ? " · Accepting orders" : null}
      </p>
      {readiness.primaryBlocker && !menuOnly ? (
        <p className="text-xs text-oo-stone-gray">
          Next: {readiness.primaryBlocker.label}
          <span className="text-oo-stone-gray"> · {ownerHint(readiness.primaryBlocker.owner)}</span>
        </p>
      ) : null}
    </div>
  );
}
