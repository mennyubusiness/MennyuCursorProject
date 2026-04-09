"use client";

import { useState } from "react";

type PodQrActionsProps = {
  absoluteUrl: string;
  /** PNG data URL from server-generated QR */
  qrDataUrl: string;
  downloadFileName: string;
};

export function PodQrActions({ absoluteUrl, qrDataUrl, downloadFileName }: PodQrActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => void copyLink()}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400 active:scale-[0.99]"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <a
        href={qrDataUrl}
        download={downloadFileName}
        className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm transition hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-400"
      >
        Download QR (PNG)
      </a>
    </div>
  );
}
