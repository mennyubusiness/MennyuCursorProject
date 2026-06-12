import type { ReadinessOwner, VendorPodReadinessStatus } from "@/lib/vendor-pod-readiness";

export type PodRosterReadinessSnapshot = {
  status: VendorPodReadinessStatus;
  label: string;
  description: string;
  canAcceptOrders: boolean;
  setupSummary: {
    profile: boolean;
    stripe: boolean;
    pos: boolean;
    menu: boolean;
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

export function PodRosterReadinessSummary({ readiness }: { readiness: PodRosterReadinessSnapshot }) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-1">
        <SetupFlag label="Profile" complete={readiness.setupSummary.profile} />
        <SetupFlag label="Stripe" complete={readiness.setupSummary.stripe} />
        <SetupFlag label="POS" complete={readiness.setupSummary.pos} />
        <SetupFlag label="Menu" complete={readiness.setupSummary.menu} />
      </div>
      <p className="text-xs text-oo-stone-gray">
        <span className="font-medium text-oo-charcoal">{readiness.label}</span>
        {readiness.canAcceptOrders ? " · Accepting orders" : null}
      </p>
      {readiness.primaryBlocker ? (
        <p className="text-xs text-oo-stone-gray">
          Next: {readiness.primaryBlocker.label}
          <span className="text-oo-stone-gray"> · {ownerHint(readiness.primaryBlocker.owner)}</span>
        </p>
      ) : null}
    </div>
  );
}
