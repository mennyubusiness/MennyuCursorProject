"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * Normalizes join code input: trim, strip spaces, uppercase (for future alphanumeric codes), keep digits.
 * Current Open Order join codes are 6-digit numeric strings.
 */
export function normalizeGroupOrderJoinCodeInput(raw: string): string {
  const compact = raw.trim().replace(/\s+/g, "").toUpperCase();
  return compact.replace(/\D/g, "");
}

type Props = {
  className?: string;
  /** When false, the block is not rendered (e.g. already in a group order). */
  visible?: boolean;
};

export function JoinGroupOrderByCodeForm({ className = "", visible = true }: Props) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!visible) return null;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const code = normalizeGroupOrderJoinCodeInput(value);
    if (!code) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (code.length !== 6) {
      setError("Code must be exactly 6 digits.");
      return;
    }
    router.push(`/group-order/join?code=${encodeURIComponent(code)}`);
  }

  return (
    <div className={cn("text-left", className)}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex-1">
          <label htmlFor="group-order-join-code" className="block text-sm font-semibold text-black">
            6-digit code
          </label>
          <input
            id="group-order-join-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={value}
            onChange={(e) => {
              const digits = normalizeGroupOrderJoinCodeInput(e.target.value).slice(0, 6);
              setValue(digits);
              if (error) setError(null);
            }}
            placeholder="000000"
            className="mt-2 min-h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 font-mono text-lg tracking-[0.35em] text-black placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:max-w-xs"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "group-order-join-code-error" : undefined}
          />
          {error ? (
            <p id="group-order-join-code-error" className="mt-2 text-sm text-brand" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className={cn(buttonClassName({ size: "lg" }), "w-full sm:mt-7 sm:w-auto")}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
