"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  serializeVendorCustomerOrderingWeek,
  validateVendorCustomerOrderingWeek,
  VENDOR_WEEKDAY_LABELS,
  VENDOR_WEEKDAYS,
  type VendorCustomerOrderingDayHours,
  type VendorCustomerOrderingWeek,
} from "@/lib/vendor-customer-ordering-hours";

const SUCCESS_COPY = "Hours updated.";
const ERROR_COPY = "We couldn't update your hours. Please try again.";

type Props = {
  vendorId: string;
  initialCustomHours: VendorCustomerOrderingWeek;
};

export function VendorCustomerOrderingHoursForm({ vendorId, initialCustomHours }: Props) {
  const router = useRouter();
  const [customHours, setCustomHours] = useState<VendorCustomerOrderingWeek>(initialCustomHours);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  function updateDay(day: VendorCustomerOrderingDayHours["day"], patch: Partial<VendorCustomerOrderingDayHours>) {
    setCustomHours((prev) => prev.map((row) => (row.day === day ? { ...row, ...patch } : row)));
    setFieldError(null);
  }

  async function onSave() {
    setMessage(null);
    setFieldError(null);

    const normalized = serializeVendorCustomerOrderingWeek(customHours);
    const validationError = validateVendorCustomerOrderingWeek(normalized);
    if (validationError) {
      setFieldError(validationError);
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/vendor/${encodeURIComponent(vendorId)}/customer-ordering-hours`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ customHours: normalized }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMessage({ text: data.error ?? ERROR_COPY, error: true });
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
                      Open
                    </label>
                  </div>

                  {row.isOpen ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="text-xs text-oo-stone-gray">
                        Open
                        <input
                          type="time"
                          required
                          value={row.openTime}
                          onChange={(e) => updateDay(day, { openTime: e.target.value })}
                          className="ml-2 rounded-md border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
                        />
                      </label>
                      <label className="text-xs text-oo-stone-gray">
                        Close
                        <input
                          type="time"
                          required
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
