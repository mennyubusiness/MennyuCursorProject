"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function VendorOrderCancelButton({
  orderId,
  vendorOrderId,
  vendorName,
}: {
  orderId: string;
  vendorOrderId: string;
  vendorName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/order/${orderId}/vendor-orders/${vendorOrderId}/cancel`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel this portion.");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? "Cancelling…" : `Cancel ${vendorName}`}
      </button>
      {error && (
        <p className="mt-1.5 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
