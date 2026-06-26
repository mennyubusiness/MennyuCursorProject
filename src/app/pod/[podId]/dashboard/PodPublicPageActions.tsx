"use client";

import Link from "next/link";
import { useState } from "react";

export function PodPublicPageActions({
  publicPageHref,
  promoteHref,
  settingsHref,
}: {
  publicPageHref: string;
  promoteHref: string;
  settingsHref: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      const absolute =
        typeof window !== "undefined" ? new URL(publicPageHref, window.location.origin).href : publicPageHref;
      await navigator.clipboard.writeText(absolute);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Link
        href={publicPageHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white"
      >
        View public page
      </Link>
      <button
        type="button"
        onClick={() => void handleCopy()}
        className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white"
      >
        {copied ? "Copied!" : "Copy public link"}
      </button>
      <Link
        href={promoteHref}
        className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white"
      >
        QR & signage
      </Link>
      <Link
        href={settingsHref}
        className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-medium text-oo-stone-gray transition hover:bg-oo-cream"
      >
        Edit pod profile
      </Link>
    </div>
  );
}
