"use client";

import { useCallback, useState } from "react";

type Props = {
  /** Primary `Vendor.id` — stable Mennyu identifier for routing and support. */
  mennyuLocationId: string;
  className?: string;
};

/**
 * Copyable Mennyu Location ID — same label and styling everywhere (Settings + POS setup).
 */
export function MennyuLocationIdField({ mennyuLocationId, className = "" }: Props) {
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

  return (
    <div className={`rounded-lg border border-stone-200 bg-stone-50/90 p-4 ${className}`}>
      <p className="text-sm font-medium text-stone-900">Mennyu Location ID</p>
      <p className="mt-1 text-xs text-stone-500">
        Use this when connecting your POS or contacting support. In Deliverect, set <strong>channelLocationId</strong>{" "}
        (external location / merchant id) to this value so Mennyu can match channel registration webhooks automatically.
      </p>
      <div className="mt-3 flex flex-wrap items-stretch gap-2 sm:items-center">
        <code
          className="min-w-0 flex-1 break-all rounded border border-stone-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-stone-900 sm:text-sm"
          title={mennyuLocationId}
        >
          {mennyuLocationId}
        </code>
        <button
          type="button"
          onClick={() => void copy()}
          className="shrink-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
