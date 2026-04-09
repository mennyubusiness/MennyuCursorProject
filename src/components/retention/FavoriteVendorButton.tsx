"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isFavoriteVendor,
  MENNYU_LOCAL_RETENTION_EVENT,
  toggleFavoriteVendor,
} from "@/lib/customer-local-storage";

export function FavoriteVendorButton({
  vendorId,
  podId,
  vendorName,
  className = "",
}: {
  vendorId: string;
  podId: string;
  vendorName: string;
  className?: string;
}) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sync = useCallback(() => {
    setSaved(isFavoriteVendor(vendorId, podId));
  }, [vendorId, podId]);

  useEffect(() => {
    setMounted(true);
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key?.includes("mennyu_favorite")) sync();
    };
    const onCustom = () => sync();
    window.addEventListener("storage", onStorage);
    window.addEventListener(MENNYU_LOCAL_RETENTION_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(MENNYU_LOCAL_RETENTION_EVENT, onCustom);
    };
  }, [sync]);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavoriteVendor(vendorId, podId, vendorName);
    setSaved(next);
  }

  const label = saved ? "Saved vendor" : "Save vendor";

  if (!mounted) {
    return (
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${className}`} aria-hidden />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-pressed={saved}
      aria-label={label}
      className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border px-2 text-sm transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${
        saved
          ? "border-rose-300/90 bg-rose-50 text-rose-700 shadow-sm"
          : "border-stone-200/90 bg-white text-stone-500 shadow-sm hover:border-mennyu-primary/35 hover:text-stone-800"
      } ${className}`}
    >
      <span className={`transition-transform duration-200 ${saved ? "scale-110" : ""}`} aria-hidden>
        {saved ? "♥" : "♡"}
      </span>
    </button>
  );
}
