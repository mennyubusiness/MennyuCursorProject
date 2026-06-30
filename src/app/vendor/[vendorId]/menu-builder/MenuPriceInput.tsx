"use client";

import { useEffect, useState } from "react";
import {
  formatCentsToMenuPrice,
  normalizeMenuPriceDraft,
  parseMenuPriceToCents,
} from "@/lib/menu-price";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function MenuPriceInput({
  cents,
  onCommit,
  disabled,
  error,
  status,
  compact,
}: {
  cents: number;
  onCommit: (raw: string) => void;
  disabled?: boolean;
  error?: string | null;
  status?: SaveStatus;
  compact?: boolean;
}) {
  const [draft, setDraft] = useState(formatCentsToMenuPrice(cents));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDraft(formatCentsToMenuPrice(cents));
    }
  }, [cents, focused]);

  return (
    <div className={compact ? "" : "space-y-1"}>
      {!compact ? <span className="text-xs text-oo-stone-gray">Price</span> : null}
      <div
        className={`flex items-center overflow-hidden rounded-lg border bg-white ${
          error ? "border-red-300" : "border-oo-light-stone"
        }`}
      >
        <span className="select-none pl-3 text-sm text-oo-stone-gray">$</span>
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const normalized = normalizeMenuPriceDraft(draft);
            setDraft(normalized);
            const parsed = parseMenuPriceToCents(normalized);
            if (parsed.ok && parsed.cents !== cents) {
              onCommit(normalized);
            } else if (!parsed.ok && draft.trim() !== formatCentsToMenuPrice(cents)) {
              onCommit(draft);
            }
          }}
          placeholder="12"
          className="min-w-0 flex-1 border-0 bg-transparent py-2 pr-3 text-sm outline-none"
          aria-invalid={Boolean(error)}
        />
      </div>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {!error && status === "saving" ? (
        <p className="text-xs text-oo-stone-gray">Saving…</p>
      ) : null}
      {!error && status === "error" ? (
        <p className="text-xs text-red-700">Couldn&apos;t save</p>
      ) : null}
    </div>
  );
}
