"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isFavoritePod,
  MENNYU_LOCAL_RETENTION_EVENT,
  toggleFavoritePod,
} from "@/lib/customer-local-storage";

type FavoritePodButtonProps = {
  podId: string;
  podName: string;
  className?: string;
  /** When true, show a text label next to the icon */
  labeled?: boolean;
};

export function FavoritePodButton({ podId, podName, className = "", labeled = false }: FavoritePodButtonProps) {
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  const sync = useCallback(() => {
    setSaved(isFavoritePod(podId));
  }, [podId]);

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
    const next = toggleFavoritePod(podId, podName);
    setSaved(next);
  }

  const label = saved ? "Saved pod" : "Save pod";

  if (!mounted) {
    return (
      <span
        className={`inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border border-transparent bg-transparent ${className}`}
        aria-hidden
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={label}
      aria-pressed={saved}
      aria-label={label}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-2.5 text-sm font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mennyu-primary active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${
        saved
          ? "border-rose-300/90 bg-rose-50 text-rose-700 shadow-sm"
          : "border-stone-200/90 bg-white/90 text-stone-500 shadow-sm hover:border-mennyu-primary/35 hover:text-stone-800"
      } ${className}`}
    >
      <span
        className={`text-base transition-transform duration-200 ${saved ? "scale-110" : ""}`}
        aria-hidden
      >
        {saved ? "♥" : "♡"}
      </span>
      {labeled && <span className="max-w-[7rem] truncate text-xs">{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
