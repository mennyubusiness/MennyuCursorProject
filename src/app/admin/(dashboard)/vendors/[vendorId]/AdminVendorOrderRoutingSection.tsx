"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { AdminReasonActionForm } from "@/components/admin/AdminReasonActionForm";
import { adminUpdateVendorOrderRoutingModeAction, adminSetSquareOrderRoutingEnabledAction } from "@/actions/admin-vendor.actions";
import type { SquareOrderRoutingReadiness } from "@/lib/integrations/square/square-order-routing-readiness";
import type { AdminSquareRoutingStatus } from "@/lib/integrations/square/square-routing-readiness";
import {
  isDeliverectRoutingMode,
  isSquareRoutingMode,
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
  squareOrderRoutingEnabled,
  squareOrderRoutingReady,
}: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  posSummary: VendorPosReadinessSummary;
  squareStatus: AdminSquareRoutingStatus;
  squareOrderRoutingEnabled: boolean;
  squareOrderRoutingReady: SquareOrderRoutingReadiness;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<VendorOrderRoutingMode>(orderRoutingMode);
  const [pending, startTransition] = useTransition();
  const deliverectMode = isDeliverectRoutingMode(mode);
  const squareModeSelected = isSquareRoutingMode(mode);
  const squareModeSaved = isSquareRoutingMode(orderRoutingMode);
  const routingReady = isVendorRoutingOperationalReady({
    ...posSummary,
    orderRoutingMode: mode,
    squareOrderRoutingEnabled: mode === "square" ? squareOrderRoutingEnabled : undefined,
    squareOrderRoutingReady: mode === "square" ? squareOrderRoutingReady.injectionOperationalReady : undefined,
  });
  const squareSelectable = squareStatus.isSelectable;

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold text-oo-charcoal">Order routing</h2>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Current mode:{" "}
        <span className="font-medium text-oo-charcoal">{vendorOrderRoutingModeAdminLabel(mode)}</span>
      </p>
      <p className="mt-2 text-xs text-oo-stone-gray">
        Menu source stays separate from order routing. Square routing keeps Open Order menu builder unless
        changed elsewhere.
      </p>

      <div className="mt-3 rounded-md border border-oo-light-stone bg-oo-cream/40 px-3 py-2 text-xs text-oo-charcoal">
        {squareStatus.isSelectable ? (
          <p>{squareStatus.statusMessage}</p>
        ) : (
          <p>
            {squareStatus.statusMessage}{" "}
            <Link href={squareStatus.integrationUrl} className="font-medium underline">
              Open Square integration
            </Link>
          </p>
        )}
        {squareStatus.connectionStatus ? (
          <p className="mt-1 text-oo-stone-gray">Connection status: {squareStatus.connectionStatus}</p>
        ) : null}
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

        <label
          className={`flex items-start gap-2 rounded-lg border border-oo-light-stone p-3 ${
            squareSelectable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
          }`}
        >
          <input
            type="radio"
            name={`routing-mode-${vendorId}`}
            checked={mode === "square"}
            disabled={!squareSelectable && mode !== "square"}
            onChange={() => {
              if (squareSelectable) setMode("square");
            }}
            className="mt-0.5"
          />
          <span>
            <span className="block text-sm font-medium text-oo-charcoal">Square</span>
            <span className="mt-1 block text-xs text-oo-stone-gray">
              {VENDOR_ROUTING_MODE_COPY.square.adminHelper}
            </span>
            {!squareSelectable ? (
              <span className="mt-1 block text-xs text-amber-900">
                {VENDOR_ROUTING_MODE_COPY.square.notConnectedWarning}
              </span>
            ) : null}
          </span>
        </label>
      </div>

      {deliverectMode && !routingReady ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.deliverect.incompleteWarning}
        </p>
      ) : null}

      {squareModeSelected && !routingReady ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.square.incompleteWarning}
          {squareOrderRoutingReady.injectionBlockingReasons.length > 0 ? (
            <span className="mt-1 block">{squareOrderRoutingReady.injectionBlockingReasons.join(" ")}</span>
          ) : null}
        </p>
      ) : null}

      {squareModeSaved ? (
        <div className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/30 p-3">
          <p className="text-sm font-medium text-oo-charcoal">Square order injection</p>
          {squareOrderRoutingEnabled ? (
            <p className="mt-1 text-xs text-oo-stone-gray">
              When enabled, paid Open Order orders for this vendor are sent to Square as prepaid pickup orders.
              Stripe checkout and Open Order payouts remain unchanged.
            </p>
          ) : (
            <p className="mt-1 text-xs text-oo-stone-gray">
              Square is connected, but order injection is disabled. Orders will be accepted in Open Order but will
              not be sent to Square.
            </p>
          )}
          {squareOrderRoutingEnabled ? (
            <AdminReasonActionForm
              label="Disable Square order injection"
              description="Stops sending new paid orders to Square. Existing Square orders are unchanged."
              confirmLabel={pending ? "Saving…" : "Disable Square order injection"}
              onSubmit={(reason) =>
                new Promise((resolve) => {
                  startTransition(async () => {
                    const result = await adminSetSquareOrderRoutingEnabledAction({
                      vendorId,
                      enabled: false,
                      reason,
                    });
                    if (result.ok) router.refresh();
                    resolve(result);
                  });
                })
              }
            />
          ) : (
            <AdminReasonActionForm
              label="Enable Square order injection"
              description="When enabled, paid Open Order orders for this vendor will be sent to Square as prepaid pickup orders. Stripe checkout and Open Order payouts remain unchanged."
              confirmLabel={pending ? "Saving…" : "Enable Square order injection"}
              disabled={!squareOrderRoutingReady.prerequisitesReady}
              disabledReason={
                squareOrderRoutingReady.prerequisiteBlockers.join(" ") || "Prerequisites incomplete."
              }
              onSubmit={(reason) =>
                new Promise((resolve) => {
                  startTransition(async () => {
                    const result = await adminSetSquareOrderRoutingEnabledAction({
                      vendorId,
                      enabled: true,
                      reason,
                    });
                    if (result.ok) router.refresh();
                    resolve(result);
                  });
                })
              }
            />
          )}
        </div>
      ) : null}

      {mode !== orderRoutingMode ? (
        <div className="mt-4">
          <AdminReasonActionForm
            label="Save order routing mode"
            description="Changes apply immediately to readiness checks and post-checkout routing."
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
                })
              })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
