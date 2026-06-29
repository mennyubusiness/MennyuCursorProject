"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { VendorOrderRoutingMode } from "@prisma/client";
import { AdminReasonActionForm } from "@/components/admin/AdminReasonActionForm";
import { adminUpdateVendorOrderRoutingModeAction } from "@/actions/admin-vendor.actions";
import {
  isDeliverectRoutingMode,
  isVendorRoutingOperationalReady,
  VENDOR_ROUTING_MODE_COPY,
  vendorOrderRoutingModeAdminLabel,
} from "@/lib/vendor-order-routing-mode";
import type { VendorPosReadinessSummary } from "@/lib/vendor-readiness-states";

export function AdminVendorOrderRoutingSection({
  vendorId,
  orderRoutingMode,
  posSummary,
}: {
  vendorId: string;
  orderRoutingMode: VendorOrderRoutingMode;
  posSummary: VendorPosReadinessSummary;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<VendorOrderRoutingMode>(orderRoutingMode);
  const [pending, startTransition] = useTransition();
  const deliverectMode = isDeliverectRoutingMode(mode);
  const routingReady = isVendorRoutingOperationalReady({ ...posSummary, orderRoutingMode: mode });

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
      <h2 className="text-sm font-semibold text-oo-charcoal">Order routing</h2>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Current mode: <span className="font-medium text-oo-charcoal">{vendorOrderRoutingModeAdminLabel(mode)}</span>
      </p>

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
      </div>

      {deliverectMode && !routingReady ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {VENDOR_ROUTING_MODE_COPY.deliverect.incompleteWarning}
        </p>
      ) : null}

      {!deliverectMode ? (
        <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          {VENDOR_ROUTING_MODE_COPY.manualDashboard.serviceReminder}
        </p>
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
                });
              })
            }
          />
        </div>
      ) : null}
    </section>
  );
}
