"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import {
  formatDayHoursLabel,
  serializeVendorCustomerOrderingWeek,
  validateVendorCustomerOrderingWeek,
  VENDOR_WEEKDAY_LABELS,
  VENDOR_WEEKDAYS,
  type VendorCustomerOrderingDayHours,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";

const SUCCESS_COPY = "Hours updated.";
const ERROR_COPY = "We couldn't update your hours. Please try again.";
const REFRESH_SUCCESS_COPY = "Hours synced from Deliverect.";
const REFRESH_ERROR_WITH_CACHE =
  "We couldn't sync hours from Deliverect. Open Order will keep using the last synced hours.";
const REFRESH_ERROR_NO_CACHE =
  "We couldn't sync hours from Deliverect. Check the Deliverect connection or enter custom Open Order hours.";

type Props = {
  vendorId: string;
  posConnected: boolean;
  initialSyncFromDeliverect: boolean;
  initialCustomHours: VendorCustomerOrderingWeek;
  syncedHours: VendorCustomerOrderingWeek | null;
  syncedHoursAt: string | null;
  syncStatus: "ok" | "failed" | null;
  syncLastError: string | null;
};

function formatSyncedAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function VendorCustomerOrderingHoursForm({
  vendorId,
  posConnected,
  initialSyncFromDeliverect,
  initialCustomHours,
  syncedHours,
  syncedHoursAt,
  syncStatus,
  syncLastError,
}: Props) {
  const router = useRouter();
  const [syncFromDeliverect, setSyncFromDeliverect] = useState(
    initialSyncFromDeliverect && posConnected
  );
  const [customHours, setCustomHours] = useState<VendorCustomerOrderingWeek>(initialCustomHours);
  const [pending, setPending] = useState(false);
  const [refreshPending, setRefreshPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const syncedList = useMemo(
    () => (syncedHours ? syncedHours.map((row) => ({ day: VENDOR_WEEKDAY_LABELS[row.day], hours: formatDayHoursLabel(row) })) : []),
    [syncedHours]
  );

  function updateDay(day: VendorCustomerOrderingDayHours["day"], patch: Partial<VendorCustomerOrderingDayHours>) {
    setCustomHours((prev) => prev.map((row) => (row.day === day ? { ...row, ...patch } : row)));
    setFieldError(null);
  }

  async function onRefreshFromDeliverect() {
    setMessage(null);
    setFieldError(null);
    setRefreshPending(true);
    try {
      const res = await fetch(
        `/api/vendor/${encodeURIComponent(vendorId)}/customer-ordering-hours/sync`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        keptPreviousHours?: boolean;
      };
      if (!res.ok) {
        const copy =
          data.keptPreviousHours === false
            ? REFRESH_ERROR_NO_CACHE
            : REFRESH_ERROR_WITH_CACHE;
        setMessage({ text: data.error ? `${copy} ${data.error}` : copy, error: true });
        return;
      }
      setMessage({ text: REFRESH_SUCCESS_COPY, error: false });
      router.refresh();
    } catch {
      setMessage({
        text: syncedHours ? REFRESH_ERROR_WITH_CACHE : REFRESH_ERROR_NO_CACHE,
        error: true,
      });
    } finally {
      setRefreshPending(false);
    }
  }

  async function onSave() {
    setMessage(null);
    setFieldError(null);

    if (syncFromDeliverect && !posConnected) {
      setFieldError("Connect your POS before syncing customer ordering hours from Deliverect.");
      return;
    }

    let payloadCustom: VendorCustomerOrderingWeek | undefined;
    if (!syncFromDeliverect) {
      const normalized = serializeVendorCustomerOrderingWeek(customHours);
      const validationError = validateVendorCustomerOrderingWeek(normalized);
      if (validationError) {
        setFieldError(validationError);
        return;
      }
      payloadCustom = normalized;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/vendor/${encodeURIComponent(vendorId)}/customer-ordering-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          syncFromDeliverect,
          customHours: payloadCustom,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; hoursSync?: { ok?: boolean } };
      if (!res.ok) {
        setMessage({ text: data.error ?? ERROR_COPY, error: true });
        return;
      }
      if (syncFromDeliverect && data.hoursSync && data.hoursSync.ok === false) {
        setMessage({
          text: syncedHours ? REFRESH_ERROR_WITH_CACHE : REFRESH_ERROR_NO_CACHE,
          error: true,
        });
        router.refresh();
        return;
      }
      setMessage({ text: SUCCESS_COPY, error: false });
      router.refresh();
    } catch {
      setMessage({ text: ERROR_COPY, error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-oo-charcoal">Hours source</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Choose how Open Order should determine when customers can place orders.
        </p>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-oo-light-stone text-brand focus:ring-brand/30"
            checked={syncFromDeliverect}
            disabled={!posConnected}
            onChange={(e) => {
              setSyncFromDeliverect(e.target.checked);
              setFieldError(null);
            }}
          />
          <span>
            <span className="block text-sm font-medium text-oo-charcoal">Sync hours from Deliverect</span>
            <span className="mt-1 block text-sm text-oo-stone-gray">
              When enabled, Open Order uses the hours from your connected POS. To change your hours, update them in
              Deliverect or your POS.
            </span>
          </span>
        </label>

        {!posConnected ? (
          <p className="mt-3 text-sm text-amber-950">
            Connect your POS in Setup before enabling Deliverect hour sync.
          </p>
        ) : null}
      </section>

      {syncFromDeliverect ? (
        <section className="rounded-2xl border border-oo-light-stone bg-oo-cream/40 p-5 text-sm">
          <h2 className="text-base font-semibold text-oo-charcoal">Hours are synced from Deliverect.</h2>
          <p className="mt-2 text-oo-stone-gray">
            Open Order will use the hours provided by your connected POS. To make changes, update your hours in
            Deliverect or your POS, then refresh below.
          </p>
          {syncedHoursAt ? (
            <p className="mt-2 text-xs text-oo-stone-gray">Last synced {formatSyncedAt(syncedHoursAt)}</p>
          ) : null}
          {syncStatus === "failed" ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
              The latest sync failed.
              {syncLastError ? ` ${syncLastError}` : ""}
              {syncedHours ? " Open Order will keep using the last synced hours." : ""}
            </p>
          ) : null}

          {syncedList.length > 0 ? (
            <ul className="mt-4 divide-y divide-oo-light-stone rounded-xl border border-oo-light-stone bg-oo-warm-white">
              {syncedList.map((row) => (
                <li key={row.day} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="font-medium text-oo-charcoal">{row.day}</span>
                  <span className="text-oo-stone-gray">{row.hours}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-oo-light-stone bg-oo-warm-white px-4 py-5 text-oo-stone-gray">
              <p className="font-medium text-oo-charcoal">No synced hours are available yet.</p>
              <p className="mt-2">
                Use Refresh hours from Deliverect below, or switch off sync to enter customer ordering hours manually.
              </p>
            </div>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => void onRefreshFromDeliverect()}
              disabled={refreshPending || !posConnected}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshPending ? "Refreshing…" : "Refresh hours from Deliverect"}
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-oo-charcoal">Customer ordering hours</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Set when customers can place orders through Open Order for each day of the week.
          </p>

          <ul className="mt-5 space-y-3">
            {VENDOR_WEEKDAYS.map((day) => {
              const row = customHours.find((d) => d.day === day)!;
              return (
                <li
                  key={day}
                  className="rounded-xl border border-oo-light-stone bg-oo-cream/30 px-4 py-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="w-28 shrink-0 font-medium text-oo-charcoal">{VENDOR_WEEKDAY_LABELS[day]}</span>
                      <label className="flex items-center gap-2 text-sm text-oo-charcoal">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-oo-light-stone text-brand focus:ring-brand/30"
                          checked={row.isOpen}
                          onChange={(e) => updateDay(day, { isOpen: e.target.checked })}
                        />
                        Open today
                      </label>
                    </div>

                    {row.isOpen ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-xs text-oo-stone-gray">
                          Open
                          <input
                            type="time"
                            value={row.openTime}
                            onChange={(e) => updateDay(day, { openTime: e.target.value })}
                            className="ml-2 rounded-md border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
                          />
                        </label>
                        <label className="text-xs text-oo-stone-gray">
                          Close
                          <input
                            type="time"
                            value={row.closeTime}
                            onChange={(e) => updateDay(day, { closeTime: e.target.value })}
                            className="ml-2 rounded-md border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
                          />
                        </label>
                      </div>
                    ) : (
                      <span className="text-sm text-oo-stone-gray">Closed</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {fieldError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{fieldError}</p>
      ) : null}

      {message ? (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            message.error ? "border border-red-200 bg-red-50 text-red-950" : "border border-emerald-200 bg-emerald-50 text-emerald-950"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={pending}
          className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save hours"}
        </button>
      </div>
    </div>
  );
}
