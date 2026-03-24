"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearPhoneSessionButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch("/api/orders/clear-phone", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className="text-sm font-medium text-stone-600 underline hover:text-stone-900 disabled:opacity-50"
    >
      {loading ? "Updating…" : "Use a different phone number"}
    </button>
  );
}
