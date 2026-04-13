"use client";

import { useState, type MouseEvent } from "react";
import { useRouter } from "next/navigation";

export function AdminPodToggle({
  podId,
  isActive,
  variant = "default",
}: {
  podId: string;
  isActive: boolean;
  variant?: "default" | "compact";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleToggle(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/pods/${podId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const cls =
    variant === "compact"
      ? "rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
      : "rounded border border-stone-300 px-2 py-1 text-xs hover:bg-stone-100 disabled:opacity-50";

  return (
    <button type="button" onClick={handleToggle} disabled={loading} className={cls}>
      {loading ? "…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
