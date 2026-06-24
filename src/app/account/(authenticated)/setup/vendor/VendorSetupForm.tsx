"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createVendorProfile } from "@/actions/account-setup.actions";
import { DashboardPageHeader } from "@/components/dashboard";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <DashboardPageHeader
        headingLevel={1}
        title="Restaurant profile"
        description="Create your workspace now — set up payments and connect your menu system when you're ready."
      />
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Business name</span>
        <input name="businessName" required className="oo-input mt-1 w-full" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Contact name</span>
        <input
          name="contactName"
          required
          autoComplete="name"
          className="oo-input mt-1 w-full"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Contact email</span>
          <input
            name="contactEmail"
            type="email"
            required
            autoComplete="email"
            className="oo-input mt-1 w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Contact phone</span>
          <input
            name="contactPhone"
            type="tel"
            required
            autoComplete="tel"
            className="oo-input mt-1 w-full"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Cuisine / category</span>
        <input
          name="cuisineCategory"
          required
          placeholder="e.g. Pizza, Mexican, Coffee"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Location (city or area)</span>
        <input
          name="locationSummary"
          placeholder="e.g. Austin, TX"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Menu system</span>
        <select name="posType" defaultValue="unknown" className="oo-input mt-1 w-full">
          {POS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Short description (optional)</span>
        <textarea name="description" rows={2} className="oo-input mt-1 w-full" />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className={cn(buttonClassName({ variant: "primary", size: "md" }), "w-full")}
      >
        {loading ? "Creating…" : "Open vendor dashboard"}
      </button>
    </form>
  );
}
