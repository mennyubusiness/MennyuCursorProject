"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateActivePricingConfig } from "@/actions/pricing-config.actions";

type Initial = {
  customerServiceFeePercent: number;
  customerServiceFeeFlatCents: number;
  vendorProcessingFeePercent: number;
  vendorProcessingFeeFlatCents: number;
};

export function AdminPricingForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const r = await updateActivePricingConfig({
      customerServiceFeePercent: Number(fd.get("customerServiceFeePercent")),
      customerServiceFeeFlatCents: Number(fd.get("customerServiceFeeFlatCents")),
      vendorProcessingFeePercent: Number(fd.get("vendorProcessingFeePercent")),
      vendorProcessingFeeFlatCents: Number(fd.get("vendorProcessingFeeFlatCents")),
      notes: String(fd.get("notes") ?? ""),
    });
    setPending(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Customer service fee (%)</span>
          <input
            name="customerServiceFeePercent"
            type="number"
            step="0.01"
            min={0}
            max={100}
            required
            defaultValue={initial.customerServiceFeePercent}
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-stone-900"
          />
          <p className="mt-1 text-xs text-stone-500">Mennyu revenue — charged to the customer on food subtotal.</p>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Service fee flat add-on (¢)</span>
          <input
            name="customerServiceFeeFlatCents"
            type="number"
            step="1"
            min={0}
            required
            defaultValue={initial.customerServiceFeeFlatCents}
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-stone-900"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Vendor processing recovery (%)</span>
          <input
            name="vendorProcessingFeePercent"
            type="number"
            step="0.01"
            min={0}
            max={100}
            required
            defaultValue={initial.vendorProcessingFeePercent}
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-stone-900"
          />
          <p className="mt-1 text-xs text-stone-500">
            Pass-through on vendor food subtotal only — not assessed on tips.
          </p>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Vendor recovery flat (¢)</span>
          <input
            name="vendorProcessingFeeFlatCents"
            type="number"
            step="1"
            min={0}
            required
            defaultValue={initial.vendorProcessingFeeFlatCents}
            className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-stone-900"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Notes (optional)</span>
        <textarea
          name="notes"
          rows={2}
          className="mt-1 w-full rounded border border-stone-200 px-2 py-1.5 text-stone-900"
          placeholder="Reason for change, ticket link, etc."
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save new active config"}
      </button>
    </form>
  );
}
