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

function EnvironmentBadge({ environment }: { environment: string }) {
  const isSandbox = environment === "sandbox";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        isSandbox
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-sky-200 bg-sky-50 text-sky-900"
      }`}
    >
      {isSandbox ? "Sandbox" : "Production"}
    </span>
  );
}

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
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const activeLocations = (connection?.availableLocations ?? []).filter(
    (loc) => (loc.status ?? "ACTIVE").toUpperCase() === "ACTIVE"
  );
  const [selectedLocationId, setSelectedLocationId] = useState(
    connection?.externalLocationId ?? activeLocations[0]?.id ?? ""
  );

  if (!snap.configured && !snap.partiallyConfigured) {
    return null;
  }

  const connectHref = `/api/vendor/${encodeURIComponent(vendorId)}/square/oauth/start`;
  const showConnect = snap.enabled && !connection;
  const connectionEnvironment =
    connection?.squareEnvironment ?? connection?.capabilitiesMeta?.squareEnvironment ?? snap.environment;

  return (
    <DashboardCard className="max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-oo-charcoal">Square</h3>
          <p className="mt-1 text-xs text-oo-stone-gray">
            Connect Square for future menu sync and order routing. Does not change checkout or
            payouts.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {snap.environment ? <EnvironmentBadge environment={snap.environment} /> : null}
            {connectionEnvironment && connectionEnvironment !== snap.environment ? (
              <span className="text-[11px] text-amber-800">
                Connected credentials: {connectionEnvironment}
              </span>
            ) : null}
          </div>
        </div>
        <span
          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
            health.isReady
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : connection?.status === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {health.isReady
            ? "Ready"
            : connection?.status === "error"
              ? "Connection error"
              : connection
                ? "Connected — setup incomplete"
                : "Not connected"}
        </span>
      </div>

      {!snap.enabled ? (
        <div className="mt-4 space-y-2 text-sm text-oo-stone-gray">
          <p>
            Square connect is disabled in this environment
            {snap.configured &&
            snap.disabledReasonLabels.includes(
              "ENABLE_SQUARE_INTEGRATION is not true in production"
            )
              ? " (set ENABLE_SQUARE_INTEGRATION=true in production)."
              : "."}
          </p>
          {snap.disabledReasonLabels.length > 0 ? (
            <ul className="list-inside list-disc text-xs">
              {snap.disabledReasonLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {(snap.missingConfigLabels.length > 0 ||
        snap.invalidConfigLabels.length > 0 ||
        snap.environmentMismatchWarnings.length > 0) &&
      !snap.configured ? (
        <ul className="mt-3 list-inside list-disc text-xs text-oo-stone-gray">
          {[...snap.missingConfigLabels, ...snap.invalidConfigLabels, ...snap.environmentMismatchWarnings].map(
            (label) => (
              <li key={label}>{label}</li>
            )
          )}
        </ul>
      ) : null}

      {snap.configured && snap.environmentMismatchWarnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-amber-900">
          {snap.environmentMismatchWarnings.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
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
              <span className="font-medium">Connected business:</span> {connection.displayName}
            </p>
          ) : null}
          {connection.externalMerchantId ? (
            <p className="font-mono text-xs text-oo-stone-gray">
              Merchant ID: {connection.externalMerchantId}
            </p>
          ) : null}
          {connection.externalLocationId ? (
            <div>
              <p>
                <span className="font-medium">Selected location:</span>{" "}
                {connection.capabilitiesMeta?.selectedLocationName ?? connection.externalLocationId}
              </p>
              {connection.selectedLocationAddress ? (
                <p className="text-xs text-oo-stone-gray">{connection.selectedLocationAddress}</p>
              ) : null}
              <p className="font-mono text-xs text-oo-stone-gray">
                Location ID: {connection.externalLocationId}
              </p>
            </div>
          ) : null}
          {connection.connectedAt ? (
            <p className="text-xs text-oo-stone-gray">
              Connected: {connection.connectedAt.toLocaleString()}
            </p>
          ) : null}
          {connection.lastHealthCheckAt ? (
            <p className="text-xs text-oo-stone-gray">
              Last checked: {connection.lastHealthCheckAt.toLocaleString()}
            </p>
          ) : null}
          {connection.lastTokenRefreshAt ? (
            <p className="text-xs text-oo-stone-gray">
              Last token refresh: {connection.lastTokenRefreshAt.toLocaleString()}
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

      {health.warnings.length > 0 ? (
        <ul className="mt-3 list-inside list-disc text-xs text-amber-900">
          {health.warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {connection?.needsLocationSelection && activeLocations.length > 0 ? (
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
            {activeLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
                {loc.addressLine ? ` — ${loc.addressLine}` : ""}
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
            {!showDisconnectConfirm ? (
              <button
                type="button"
                disabled={pending}
                className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-60"
                onClick={() => setShowDisconnectConfirm(true)}
              >
                Disconnect
              </button>
            ) : (
              <div className="w-full space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950">
                <p>
                  Disconnecting Square stops future Square sync/order routing for this vendor. It
                  does not affect Open Order checkout, payouts, or historical records.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex items-center justify-center rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
                    onClick={() => {
                      setError(null);
                      startTransition(async () => {
                        const result = await disconnectSquareAction(vendorId);
                        if (!result.ok) setError(result.error);
                        else {
                          setShowDisconnectConfirm(false);
                          router.refresh();
                        }
                      });
                    }}
                  >
                    {pending ? "Disconnecting…" : "Confirm disconnect"}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    className="inline-flex items-center justify-center rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50"
                    onClick={() => setShowDisconnectConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </DashboardCard>
  );
}
