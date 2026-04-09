"use client";

import { useCallback, useState } from "react";

type Props = {
  /** Primary `Vendor.id` — stable Mennyu identifier for routing and support. */
  mennyuLocationId: string;
  className?: string;
  /** Larger, higher-contrast block for guided POS onboarding (copy this into Deliverect as `channelLocationId`). */
  variant?: "default" | "emphasized";
};

/**
 * Copyable Mennyu Location ID — same label and styling everywhere (Settings + POS setup).
 */
export function MennyuLocationIdField({ mennyuLocationId, className = "", variant = "default" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mennyuLocationId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context)
    }
  }, [mennyuLocationId]);

  const box =
    variant === "emphasized"
      ? "rounded-xl border-2 border-mennyu-primary/30 bg-gradient-to-b from-white to-stone-50/90 p-5 shadow-sm ring-1 ring-stone-200/80"
      : "rounded-lg border border-stone-200 bg-stone-50/90 p-4";

  return (
    <div className={`${box} ${className}`}>
      <p className={variant === "emphasized" ? "text-base font-semibold text-stone-900" : "text-sm font-medium text-stone-900"}>
        Mennyu Location ID
        {variant === "emphasized" ? (
          <span className="ml-2 text-sm font-normal text-stone-500">— paste this into Deliverect</span>
        ) : null}
      </p>
      <p className="mt-1 text-xs text-stone-500 leading-relaxed">
        {variant === "emphasized" ? (
          <>
            This is the value for Deliverect&apos;s <strong>channelLocationId</strong> (merchant / external location id).
            It is <strong>not</strong> the same as the Deliverect channel link id you get after activation — that one is
            applied automatically.
          </>
        ) : (
          <>
            Use this when connecting your POS or contacting support. In Deliverect, set <strong>channelLocationId</strong>{" "}
            (external location / merchant id) to this value so Mennyu can match channel registration webhooks automatically.
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-stretch gap-2 sm:items-center">
        <code
          className={
            variant === "emphasized"
              ? "min-w-0 flex-1 break-all rounded-lg border border-stone-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-stone-900 md:text-base"
              : "min-w-0 flex-1 break-all rounded border border-stone-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-stone-900 sm:text-sm"
          }
          title={mennyuLocationId}
        >
          {mennyuLocationId}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className={
            variant === "emphasized"
              ? "shrink-0 rounded-lg border border-stone-300 bg-stone-900 px-4 py-3 text-sm font-medium text-white hover:bg-stone-800"
              : "shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
          }
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
