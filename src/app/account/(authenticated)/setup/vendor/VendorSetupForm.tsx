"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVendorProfile } from "@/actions/account-setup.actions";

const POS_OPTIONS = [
  { value: "toast", label: "Toast" },
  { value: "square", label: "Square" },
  { value: "clover", label: "Clover" },
  { value: "lightspeed", label: "Lightspeed / K" },
  { value: "other", label: "Other" },
  { value: "unknown", label: "Not sure yet" },
];

export function VendorSetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const r = await createVendorProfile({
        businessName: String(fd.get("businessName") ?? ""),
        contactName: String(fd.get("contactName") ?? ""),
        contactEmail: String(fd.get("contactEmail") ?? ""),
        contactPhone: String(fd.get("contactPhone") ?? ""),
        cuisineCategory: String(fd.get("cuisineCategory") ?? ""),
        posType: String(fd.get("posType") ?? "unknown"),
        description: String(fd.get("description") ?? "") || undefined,
        locationSummary: String(fd.get("locationSummary") ?? "").trim() || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.vendorId) {
        router.push(`/vendor/${r.vendorId}`);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Restaurant profile</h1>
        <p className="mt-1 text-sm text-stone-600">
          Create your workspace now — payouts and POS connection are next steps you can finish when you&apos;re ready.
        </p>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Business name</span>
        <input
          name="businessName"
          required
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Contact name</span>
        <input
          name="contactName"
          required
          autoComplete="name"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Contact email</span>
          <input
            name="contactEmail"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Contact phone</span>
          <input
            name="contactPhone"
            type="tel"
            required
            autoComplete="tel"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Cuisine / category</span>
        <input
          name="cuisineCategory"
          required
          placeholder="e.g. Pizza, Mexican, Coffee"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Location (city or area)</span>
        <input
          name="locationSummary"
          placeholder="e.g. Austin, TX"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">POS / order system</span>
        <select
          name="posType"
          defaultValue="unknown"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        >
          {POS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Short description (optional)</span>
        <textarea
          name="description"
          rows={2}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Creating…" : "Open vendor dashboard"}
      </button>
    </form>
  );
}
