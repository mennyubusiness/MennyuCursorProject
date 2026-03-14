"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminVendorToggle({
  vendorId,
  isActive,
}: {
  vendorId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/vendors/${vendorId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50"
    >
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
