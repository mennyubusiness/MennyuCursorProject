"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VendorOption = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
};

export function PodDashboardAddVendor({
  podId,
  eligibleVendors,
}: {
  podId: string;
  eligibleVendors: VendorOption[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRequest() {
    if (!selectedId) return;

    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/pod/${podId}/membership-requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to create request");
        return;
      }
      setSuccess("Request sent. Awaiting vendor approval.");
      setSelectedId("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[200px]">
          <span className="sr-only">Vendor to request</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded border border-stone-300 px-3 py-2 text-stone-900 focus:border-mennyu-primary focus:outline-none focus:ring-1 focus:ring-mennyu-primary"
          >
            <option value="">Select a vendor…</option>
            {eligibleVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {(!v.isActive || v.mennyuOrdersPaused) && " — "}
                {!v.isActive && "Inactive"}
                {!v.isActive && v.mennyuOrdersPaused && ", "}
                {v.mennyuOrdersPaused && "Mennyu paused"}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={handleRequest}
          disabled={!selectedId || loading}
          className="rounded bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900 disabled:opacity-50"
        >
          {loading ? "…" : "Request vendor to join"}
        </button>
      </div>
    </div>
  );
}
