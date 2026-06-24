"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPodProfile } from "@/actions/account-setup.actions";
import { DashboardPageHeader } from "@/components/dashboard";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function PodSetupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    try {
      const r = await createPodProfile({
        podName: String(fd.get("podName") ?? ""),
        ownerContactName: String(fd.get("ownerContactName") ?? ""),
        ownerContactPhone: String(fd.get("ownerContactPhone") ?? ""),
        address: String(fd.get("address") ?? "") || undefined,
        description: String(fd.get("description") ?? "") || undefined,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.podId) {
        router.push(`/pod/${r.podId}/dashboard`);
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
        title="Pod profile"
        description="A pod is a pickup hub with one or more vendors. You can invite restaurants after this step."
      />
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Pod name</span>
        <input
          name="podName"
          required
          placeholder="e.g. Downtown Food Hall"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Your name</span>
        <input
          name="ownerContactName"
          required
          autoComplete="name"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Phone</span>
        <input
          name="ownerContactPhone"
          type="tel"
          required
          autoComplete="tel"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Location / address (optional)</span>
        <input
          name="address"
          autoComplete="street-address"
          className="oo-input mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-oo-charcoal">Short description (optional)</span>
        <textarea
          name="description"
          rows={2}
          placeholder="What should diners know?"
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
        {loading ? "Creating…" : "Open pod dashboard"}
      </button>
    </form>
  );
}
