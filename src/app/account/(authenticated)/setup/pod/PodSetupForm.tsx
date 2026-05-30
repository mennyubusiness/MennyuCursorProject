"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPodProfile } from "@/actions/account-setup.actions";

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
    <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Pod profile</h1>
        <p className="mt-1 text-sm text-stone-600">
          A pod is a pickup hub with one or more vendors. You can invite restaurants after this step.
        </p>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Pod name</span>
        <input
          name="podName"
          required
          placeholder="e.g. Downtown Food Hall"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Your name</span>
        <input
          name="ownerContactName"
          required
          autoComplete="name"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Phone</span>
        <input
          name="ownerContactPhone"
          type="tel"
          required
          autoComplete="tel"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Location / address (optional)</span>
        <input
          name="address"
          autoComplete="street-address"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Short description (optional)</span>
        <textarea
          name="description"
          rows={2}
          placeholder="What should diners know?"
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
        {loading ? "Creating…" : "Open pod dashboard"}
      </button>
    </form>
  );
}
