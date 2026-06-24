"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCustomerProfile } from "@/actions/account-setup.actions";
import { DashboardPageHeader } from "@/components/dashboard";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function CustomerSetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const r = await saveCustomerProfile({
        firstName: String(fd.get("firstName") ?? ""),
        lastName: String(fd.get("lastName") ?? ""),
        phone: String(fd.get("phone") ?? "") || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/orders");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
      <DashboardPageHeader
        headingLevel={1}
        title="Your details"
        description="We use this to personalize receipts and support. You can refine it later."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">First name</span>
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="oo-input mt-1 w-full"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-oo-charcoal">Last name</span>
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className="oo-input mt-1 w-full"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Phone (optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="For order updates"
          className="oo-input mt-1 w-full"
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
        className={cn(buttonClassName({ variant: "primary", size: "md" }), "w-full")}
      >
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
