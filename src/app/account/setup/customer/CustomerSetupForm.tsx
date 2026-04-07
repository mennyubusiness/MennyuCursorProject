"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCustomerProfile } from "@/actions/account-setup.actions";

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
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Your details</h1>
        <p className="mt-1 text-sm text-stone-600">
          We use this to personalize receipts and support. You can refine it later.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-stone-800">First name</span>
          <input
            name="firstName"
            required
            autoComplete="given-name"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-stone-800">Last name</span>
          <input
            name="lastName"
            required
            autoComplete="family-name"
            className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Phone (optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="For order updates"
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
        {loading ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
