"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DashboardCard } from "@/components/dashboard";
import {
  disconnectSquareAction,
  selectSquareLocationAction,
} from "@/actions/vendor-square-connect.actions";
import type { ProviderConnectionHealth } from "@/lib/integrations/types";
import type { SquareConfigSnapshot } from "@/lib/integrations/square/square-config";
import type { SquareConnectionView } from "@/lib/integrations/square/square-connection.service";

export function VendorSquareConnectionCard({
  vendorId,
  snap,
  connection,
  health,
}: {
  vendorId: string;
  snap: SquareConfigSnapshot;
  connection: SquareConnectionView | null;
  health: ProviderConnectionHealth;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState(
    connection?.externalLocationId ?? connection?.availableLocations[0]?.id ?? ""
  );

  if (!snap.configured && !snap.partiallyConfigured) {
    return null;
  }

  const connectHref = `/api/vendor/${encodeURIComponent(vendorId)}/square/oauth/start`;
  const showConnect = snap.enabled && !connection;

  return (
    <DashboardCard className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-oo-charcoal">Square</h3>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Connect Square for future menu sync and order routing. Does not change checkout or
            payouts.
          </p>
          {snap.environment ? (
            <p className="mt-1 text-[11px] uppercase tracking-wide text-oo-stone-gray">
              Environment: {snap.environment}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            health.isReady
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {health.isReady ? "Ready" : connection ? "Connected — setup incomplete" : "Not connected"}
        </span>
      </div>

      {!snap.enabled ? (
        <p className="mt-4 text-sm text-oo-stone-gray">
          Square connect is disabled in this environment
          {snap.configured ? " (set ENABLE_SQUARE_INTEGRATION=true in production)." : "."}
        </p>
      ) : null}

      {!snap.tokenStorageReady ? (
        <p className="mt-4 text-sm text-amber-900">
          Token storage is not configured. Set INTEGRATION_TOKEN_ENCRYPTION_KEY before connecting
          Square in production.
        </p>
      ) : null}

      {connection ? (
        <div className="mt-4 space-y-3 text-sm text-oo-charcoal">
          <p>
            <span className="font-medium">Status:</span> {connection.status}
          </p>
          {connection.displayName ? (
            <p>
              <span className="font-medium">Account:</span> {connection.displayName}
            </p>
          ) : null}
          {connection.externalMerchantId ? (
            <p className="font-mono text-xs text-oo-stone-gray">
              Merchant: {connection.externalMerchantId}
            </p>
          ) : null}
          {connection.externalLocationId ? (
            <p>
              <span className="font-medium">Location:</span>{" "}
              {connection.capabilitiesMeta?.selectedLocationName ?? connection.externalLocationId}
              <span className="ml-1 font-mono text-xs text-oo-stone-gray">
                ({connection.externalLocationId})
              </span>
            </p>
          ) : null}
          {connection.lastHealthCheckAt ? (
            <p className="text-xs text-oo-stone-gray">
              Last health check: {connection.lastHealthCheckAt.toLocaleString()}
            </p>
          ) : null}
          {connection.errorMessage ? (
            <p className="text-sm text-red-700">{connection.errorMessage}</p>
          ) : null}
        </div>
      ) : null}

      {health.missingRequirements.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-oo-stone-gray">
          {health.missingRequirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {connection?.needsLocationSelection && connection.availableLocations.length > 0 ? (
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const result = await selectSquareLocationAction(vendorId, selectedLocationId);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              router.refresh();
            });
          }}
        >
          <label className="block text-sm font-medium text-oo-charcoal" htmlFor="square-location">
            Select Square location
          </label>
          <select
            id="square-location"
            className="w-full rounded-lg border border-oo-light-stone bg-white px-3 py-2 text-sm"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            disabled={pending}
          >
            {connection.availableLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.status ? `(${loc.status})` : ""}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending || !selectedLocationId}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save location"}
          </button>
        </form>
      ) : null}

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        {showConnect && snap.tokenStorageReady ? (
          <a
            href={connectHref}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
          >
            Connect Square
          </a>
        ) : null}
        {connection && snap.enabled ? (
          <>
            <a
              href={connectHref}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Reconnect Square
            </a>
            <button
              type="button"
              disabled={pending}
              className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await disconnectSquareAction(vendorId);
                  if (!result.ok) setError(result.error);
                  else router.refresh();
                });
              }}
            >
              Disconnect
            </button>
          </>
        ) : null}
      </div>
    </DashboardCard>
  );
}
