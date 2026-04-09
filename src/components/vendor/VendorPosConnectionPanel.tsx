import Link from "next/link";
import type { PosConnectionStatus } from "@prisma/client";
import {
  deriveVendorPosUiState,
  vendorPosUiStateGuidance,
  vendorPosUiStateLabel,
  type VendorPosUiState,
} from "@/lib/vendor-pos-ui-state";
import { VendorPosConnectionRetryButton } from "./VendorPosConnectionRetryButton";

export type VendorPosConnectionPanelProps = {
  vendorId: string;
  vendorName: string;
  deliverectChannelLinkId: string | null;
  deliverectLocationId: string | null;
  posConnectionStatus: PosConnectionStatus;
  pendingDeliverectConnectionKey: string | null;
  deliverectAutoMapLastOutcome: string | null;
  deliverectAutoMapLastAt: Date | null;
  hasUnmatchedChannelRegistration: boolean;
};

function stateTone(ui: VendorPosUiState): string {
  switch (ui) {
    case "connected":
      return "border-emerald-200 bg-emerald-50/70";
    case "waiting_for_activation":
      return "border-sky-200 bg-sky-50/60";
    case "needs_attention":
      return "border-amber-300 bg-amber-50/80";
    case "not_connected":
    default:
      return "border-stone-200 bg-white";
  }
}

export function VendorPosConnectionPanel(props: VendorPosConnectionPanelProps) {
  const {
    vendorId,
    vendorName,
    deliverectChannelLinkId,
    deliverectLocationId,
    posConnectionStatus,
    pendingDeliverectConnectionKey,
    deliverectAutoMapLastOutcome,
    deliverectAutoMapLastAt,
    hasUnmatchedChannelRegistration,
  } = props;

  const ui = deriveVendorPosUiState({
    deliverectChannelLinkId,
    posConnectionStatus,
    deliverectAutoMapLastOutcome,
    pendingDeliverectConnectionKey,
    hasUnmatchedChannelRegistrationForVendor: hasUnmatchedChannelRegistration,
  });

  const label = vendorPosUiStateLabel(ui);
  const guidance = vendorPosUiStateGuidance(ui, {
    hasUnmatchedRegistration: hasUnmatchedChannelRegistration,
  });
  const connectHref = `/vendor/${vendorId}/connect-pos`;

  return (
    <section className={`rounded-xl border p-5 shadow-sm ${stateTone(ui)}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Kitchen POS connection</h3>
            <p className="mt-1 text-sm text-stone-600">
              <span className="font-medium text-stone-800">{vendorName}</span> — Deliverect links Mennyu to your POS for
              tickets and status.
            </p>
          </div>

          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Status</dt>
              <dd className="font-medium text-stone-900">{label}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Mennyu Location ID</dt>
              <dd className="break-all font-mono text-xs text-stone-800" title="Paste into Deliverect as channelLocationId">
                {vendorId}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Deliverect channel link ID <span className="font-normal normal-case text-stone-400">(routes orders)</span>
              </dt>
              <dd className="break-all font-mono text-xs text-stone-800">
                {deliverectChannelLinkId?.trim() ? deliverectChannelLinkId : "— not linked yet"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Deliverect location ID <span className="font-normal normal-case text-stone-400">(optional)</span>
              </dt>
              <dd className="break-all font-mono text-xs text-stone-700">
                {deliverectLocationId?.trim() ? deliverectLocationId : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Last auto-connect</dt>
              <dd className="text-xs text-stone-700">
                {deliverectAutoMapLastAt
                  ? `${deliverectAutoMapLastAt.toISOString().replace("T", " ").slice(0, 19)} UTC`
                  : "—"}
                {deliverectAutoMapLastOutcome ? (
                  <span className="ml-1 font-mono text-[11px] text-stone-500">({deliverectAutoMapLastOutcome})</span>
                ) : null}
              </dd>
            </div>
          </dl>

          <p className="text-sm leading-relaxed text-stone-700">{guidance}</p>

          {ui === "needs_attention" && hasUnmatchedChannelRegistration ? (
            <div className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-950">
              <p className="font-medium">We couldn’t match your last Deliverect activation</p>
              <p className="mt-1 text-xs text-amber-900/90">
                Confirm the Mennyu Location ID above is entered exactly in Deliverect, then tap &quot;Check connection
                again&quot;. If it still fails, contact support.
              </p>
              <VendorPosConnectionRetryButton vendorId={vendorId} />
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch">
          <Link
            href={connectHref}
            className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-stone-800"
          >
            {ui === "connected" ? "Manage POS connection" : "Set up POS connection"}
          </Link>
        </div>
      </div>
    </section>
  );
}
