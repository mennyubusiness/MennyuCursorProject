"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Normalizes join code input: trim, strip spaces, uppercase (for future alphanumeric codes), keep digits.
 * Current Mennyu join codes are 6-digit numeric strings.
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
    <div className={`rounded-xl border border-stone-200 bg-stone-50/80 p-4 text-left text-sm ${className}`}>
      <p className="font-medium text-stone-900">Join a group order by code</p>
      <p className="mt-1 text-xs text-stone-600">Enter the 6-digit code from the host.</p>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="group-order-join-code" className="sr-only">
          6-digit group order code
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
          className="min-h-[44px] w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-base tracking-widest text-stone-900 placeholder:text-stone-400 sm:max-w-[11rem]"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "group-order-join-code-error" : undefined}
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-lg border border-stone-400 bg-white px-4 py-2 font-semibold text-stone-900 hover:bg-stone-100"
        >
          Continue
        </button>
      </form>
      {error ? (
        <p id="group-order-join-code-error" className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
