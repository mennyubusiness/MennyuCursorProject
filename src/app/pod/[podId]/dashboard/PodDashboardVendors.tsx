"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type VendorRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  mennyuOrdersPaused: boolean;
};

export function PodDashboardVendors({
  podId,
  vendors,
}: {
  podId: string;
  vendors: VendorRow[];
}) {
  const router = useRouter();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove(vendorId: string, vendorName: string) {
    const confirmed = window.confirm(
      `Remove ${vendorName} from this pod? They will no longer appear in this pod’s menu. The vendor account and past orders are not affected.`
    );
    if (!confirmed) return;

    setError(null);
    setRemovingId(vendorId);
    try {
      const res = await fetch(`/api/pod/${podId}/vendors/${vendorId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to remove vendor");
        return;
      }
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <ul className="rounded-lg border border-stone-200 bg-white">
        {vendors.map((v) => (
          <li
            key={v.id}
            className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 px-4 py-3 last:border-0"
          >
            <div>
              <span className="font-medium text-stone-900">{v.name}</span>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-stone-500">
                {!v.isActive && <span>Inactive</span>}
                {v.mennyuOrdersPaused && <span>Mennyu paused</span>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(v.id, v.name)}
              disabled={removingId !== null}
              className="rounded border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-50"
            >
              {removingId === v.id ? "…" : "Remove"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
