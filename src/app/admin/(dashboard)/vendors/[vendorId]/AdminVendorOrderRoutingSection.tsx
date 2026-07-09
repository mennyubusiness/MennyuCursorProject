"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { AdminReasonActionForm } from "@/components/admin/AdminReasonActionForm";
import { adminUpdateVendorOrderRoutingModeAction } from "@/actions/admin-vendor.actions";
import type { SquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";
import type { AdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import {
  ADMIN_ORDER_ROUTING_GENERIC_COPY,
  adminActiveRoutingStatusMessage,
  adminSquareRoutingStatusSummary,
} from "@/lib/integrations/provider-display";
import {
  isDeliverectRoutingMode,
  isSquareRoutingMode,
  isVendorDeliverectPosConnected,
  isVendorRoutingOperationalReady,
  VENDOR_ROUTING_MODE_COPY,
  vendorOrderRoutingModeAdminLabel,
} from "@/lib/vendor-order-routing-mode";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";

export function AdminVendorOrderRoutingSection({
  vendorId,
  orderRoutingMode,
  posSummary,
  squareStatus,
  squareOrderRoutingReady,
}: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  posSummary: VendorPosReadinessSummary;
  squareStatus: AdminSquareRoutingStatus;
  squareOrderRoutingReady: SquareOrderRoutingReadiness;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<VendorOrderRoutingMode>(orderRoutingMode);
  const [pending, startTransition] = useTransition();
  const deliverectMode = isDeliverectRoutingMode(mode);
  const squareModeSelected = isSquareRoutingMode(mode);
  const squareModeSaved = isSquareRoutingMode(orderRoutingMode);
  const deliverectConnected = isVendorDeliverectPosConnected(posSummary);
  const routingReady = isVendorRoutingOperationalReady({
    ...posSummary,
    orderRoutingMode: mode,
    squareOrderRoutingReady: mode === "square" ? squareOrderRoutingReady.injectionOperationalReady : undefined,
  });
  const activeStatus = adminActiveRoutingStatusMessage({
    orderRoutingMode,
    deliverectConnected,
    posConnectionStatus: posSummary.posConnectionStatus,
    squareStatusMessage: squareStatus.statusMessage,
    squareConnectionStatus: squareStatus.connectionStatus,
  });
  const squareSummary = adminSquareRoutingStatusSummary(squareOrderRoutingReady);

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold text-oo-charcoal">Order routing</h2>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Current mode:{" "}
        <span className="font-medium text-oo-charcoal">{vendorOrderRoutingModeAdminLabel(orderRoutingMode)}</span>
      </p>
      <p className="mt-2 text-xs text-oo-stone-gray">{ADMIN_ORDER_ROUTING_GENERIC_COPY}</p>

      <div className="mt-3 rounded-md border border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-xs text-oo-charcoal">
        <p className="font-medium text-oo-charcoal">Active routing</p>
        <p className="mt-1">{activeStatus.message}</p>
        {activeStatus.detail ? <p className="mt-1 text-oo-stone-gray">{activeStatus.detail}</p> : null}
      </div>

      <div className="mt-4 space-y-3">
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-oo-light-stone p-3">
          <input
            type="radio"
            name={`routing-mode-${vendorId}`}
            checked={mode === "manual_dashboard"}
            onChange={() => setMode("manual_dashboard")}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-oo-charcoal">Open Order Dashboard / Tablet</span>
            <span className="mt-1 block text-xs text-oo-stone-gray">
              {VENDOR_ROUTING_MODE_COPY.manualDashboard.adminHelper}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-oo-light-stone p-3">
          <input
            type="radio"
            name={`routing-mode-${vendorId}`}
            checked={mode === "deliverect"}
            onChange={() => setMode("deliverect")}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-oo-charcoal">Deliverect / POS-connected routing</span>
            <span className="mt-1 block text-xs text-oo-stone-gray">
              {VENDOR_ROUTING_MODE_COPY.deliverect.adminHelper}
            </span>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-oo-light-stone p-3">
          <input
            type="radio"
            name={`routing-mode-${vendorId}`}
            checked={mode === "square"}
            onChange={() => setMode("square")}
            className="mt-0.5"
          />
          <span className="w-full">
            <span className="block text-sm font-medium text-oo-charcoal">Square</span>
            <span className="mt-1 block text-xs text-oo-stone-gray">
              {VENDOR_ROUTING_MODE_COPY.square.adminHelper}
            </span>
            {squareModeSelected ? (
              <div className="mt-3 space-y-2 rounded-md border border-oo-light-stone bg-oo-warm-white px-3 py-2 text-xs text-oo-charcoal">
                <p className={squareSummary.ready ? "text-emerald-900" : "text-amber-950"}>
                  {squareSummary.headline}
                </p>
                <dl className="grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-oo-stone-gray">Square connection</dt>
                    <dd className="font-medium">
                      {squareOrderRoutingReady.connectionHealthy ? "connected" : "missing"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-oo-stone-gray">Selected location</dt>
                    <dd className="font-medium">
                      {squareOrderRoutingReady.locationId?.trim() ? "present" : "missing"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-oo-stone-gray">Published Square menu</dt>
                    <dd className="font-medium">
                      {squareOrderRoutingReady.hasSquarePublishedMenu ? "present" : "missing"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-oo-stone-gray">Item mappings</dt>
                    <dd className="font-medium">
                      {squareOrderRoutingReady.activeItemMappingCount > 0 ? "ready" : "missing"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-oo-stone-gray">SQUARE_ROUTING_LIVE</dt>
                    <dd className="font-medium">
                      {squareOrderRoutingReady.globalRoutingLive ? "true" : "false"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-oo-stone-gray">Routing status</dt>
                    <dd className="font-medium">
                      {squareSummary.ready
                        ? "Ready to send paid orders to Square"
                        : "Not ready"}
                    </dd>
                  </div>
                </dl>
                {!squareSummary.ready && squareSummary.blockers.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-900">
                    {squareSummary.blockers.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                <Link href={squareStatus.integrationUrl} className="mt-2 inline-block font-medium underline">
                  Open Square integration
                </Link>
              </div>
            ) : null}
          </span>
        </label>
      </div>

      {deliverectMode && !routingReady ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.deliverect.incompleteWarning}
        </p>
      ) : null}

      {squareModeSelected && !routingReady && squareModeSaved ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.square.incompleteWarning}
        </p>
      ) : null}

      {mode !== orderRoutingMode ? (
        <div className="mt-4">
          <AdminReasonActionForm
            label="Save order routing mode"
            description="Changes apply immediately to readiness checks, vendor setup UI, and post-checkout routing intent."
            confirmLabel={pending ? "Saving…" : "Save routing mode"}
            onSubmit={(reason) =>
              new Promise((resolve) => {
                startTransition(async () => {
                  const result = await adminUpdateVendorOrderRoutingModeAction({
                    vendorId,
                    orderRoutingMode: mode,
                    reason,
                  });
                  if (result.ok) router.refresh();
                  resolve(result);
                });
              })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
