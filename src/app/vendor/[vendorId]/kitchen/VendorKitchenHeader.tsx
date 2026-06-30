"use client";

import Link from "next/link";
import { isManualDashboardRoutingMode } from "@/lib/vendor-order-routing-mode";
import { VendorKitchenPauseToggle } from "./VendorKitchenPauseToggle";
import { VendorKitchenTestSoundButton } from "./VendorKitchenTestSoundButton";

function formatLastUpdated(lastFetchedAtMs: number | null, nowMs: number): string {
  if (lastFetchedAtMs == null) return "Connecting…";
  const ageSec = Math.max(0, Math.floor((nowMs - lastFetchedAtMs) / 1000));
  if (ageSec < 8) return "Live";
  if (ageSec < 60) return `Updated ${ageSec}s ago`;
  const ageMin = Math.floor(ageSec / 60);
  return `Updated ${ageMin}m ago`;
}

export function VendorKitchenHeader({
  vendorId,
  vendorName,
  orderRoutingMode,
  intakePaused,
  onIntakePausedChange,
  posWarning,
  lastFetchedAtMs,
  nowMs,
  fetchError,
}: {
  vendorId: string;
  vendorName: string;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  intakePaused: boolean;
  onIntakePausedChange: (paused: boolean) => void;
  posWarning: string | null;
  lastFetchedAtMs: number | null;
  nowMs: number;
  fetchError: string | null;
}) {
  const manualDashboard = isManualDashboardRoutingMode(orderRoutingMode);
  const connectionLabel = fetchError ? "Connection issue" : formatLastUpdated(lastFetchedAtMs, nowMs);
  const connectionTone = fetchError
    ? "text-red-800"
    : lastFetchedAtMs != null && nowMs - lastFetchedAtMs < 15_000
      ? "text-emerald-800"
      : "text-oo-stone-gray";

  return (
    <header className="sticky top-0 z-30 border-b border-oo-light-stone bg-oo-warm-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-oo-stone-gray">{vendorName}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-oo-charcoal sm:text-2xl">Kitchen Mode</h1>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${
                intakePaused
                  ? "bg-amber-100 text-amber-950"
                  : "bg-emerald-100 text-emerald-900"
              }`}
            >
              {intakePaused ? "Paused" : "Accepting orders"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <p className={`text-xs font-medium tabular-nums ${connectionTone}`} aria-live="polite">
            {connectionLabel}
          </p>
          <VendorKitchenTestSoundButton />
          <VendorKitchenPauseToggle
            vendorId={vendorId}
            initialPaused={intakePaused}
            onPausedChange={onIntakePausedChange}
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
        <div className="border-t border-amber-300 bg-amber-100 px-4 py-2 text-center text-sm font-semibold text-amber-950 sm:px-6">
          Order intake paused — no new customer orders. Active orders stay below.
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
