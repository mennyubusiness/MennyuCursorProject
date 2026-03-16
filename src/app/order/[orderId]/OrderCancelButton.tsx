"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderCancelButton({
  orderId,
  disabled,
  disabledMessage,
  onSuccess,
}: {
  orderId: string;
  disabled: boolean;
  disabledMessage?: string;
  /** When provided, called on success instead of router.refresh() so parent can update local state. */
  onSuccess?: (data: { status: string }) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (disabled) {
    return disabledMessage ? (
      <p className="mt-4 text-sm text-stone-500">{disabledMessage}</p>
    ) : null;
  }

  async function handleCancel() {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/order/${orderId}/cancel`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not cancel order");
        return;
      }
      if (onSuccess && data.status != null) {
        onSuccess({ status: data.status });
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800 hover:bg-red-100 disabled:opacity-50"
      >
        {loading ? "Cancelling…" : "Cancel order"}
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
