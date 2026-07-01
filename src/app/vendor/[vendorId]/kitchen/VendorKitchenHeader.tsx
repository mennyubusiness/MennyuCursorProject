"use client";

import Link from "next/link";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";
import { VendorKitchenPauseToggle } from "./VendorKitchenPauseToggle";
import { VendorKitchenTestSoundButton } from "./VendorKitchenTestSoundButton";

export function VendorKitchenHeader({
  vendorId,
  vendorName,
  orderRoutingMode,
  intakePaused,
  onIntakePausedChange,
  posWarning,
  posManaged = false,
}: {
  vendorId: string;
  vendorName: string;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  intakePaused: boolean;
  onIntakePausedChange: (paused: boolean) => void;
  posWarning: string | null;
  posManaged?: boolean;
}) {
  const manualDashboard = isManualDashboardRoutingMode(orderRoutingMode);

  return (
    <header className="sticky top-0 z-30 border-b border-oo-light-stone bg-oo-warm-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-oo-stone-gray">{vendorName}</p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">
            Kitchen Mode
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <VendorKitchenTestSoundButton />
          <VendorKitchenPauseToggle
            vendorId={vendorId}
            initialPaused={intakePaused}
            onPausedChange={onIntakePausedChange}
            posManaged={posManaged}
          />
          <Link
            href={`/vendor/${vendorId}/dashboard`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal shadow-sm transition hover:bg-oo-cream"
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      {intakePaused ? (
        <div className="border-t border-amber-300 bg-amber-100 px-4 py-1.5 text-center text-sm font-medium text-amber-950 sm:px-6">
          Intake paused — active orders stay below.
        </div>
      ) : null}

      {!manualDashboard && posWarning ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-950 sm:px-6">
          {posWarning}
        </div>
      ) : null}
    </header>
  );
}
