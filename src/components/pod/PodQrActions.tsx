"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonClassName } from "@/components/ui/button";

type PodQrActionsProps = {
  publicPageUrl: string;
  publicPageHref: string;
  qrDataUrl: string;
  downloadFileName: string;
  signSvgDataUrl?: string;
  signDownloadFileName?: string;
};

export function PodQrActions({
  publicPageUrl,
  publicPageHref,
  qrDataUrl,
  downloadFileName,
  signSvgDataUrl,
  signDownloadFileName,
}: PodQrActionsProps) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicPageUrl);
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
        className={buttonClassName({ variant: "outline", size: "sm" })}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={qrDataUrl}
        download={downloadFileName}
        className={buttonClassName({ variant: "outline", size: "sm" })}
      >
        Download QR
      </a>
      {signSvgDataUrl && signDownloadFileName ? (
        <a
          href={signSvgDataUrl}
          download={signDownloadFileName}
          className={buttonClassName({ variant: "outline", size: "sm" })}
        >
          Download QR sign
        </a>
      ) : null}
      <Link
        href={publicPageHref}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClassName({ variant: "secondary", size: "sm" })}
      >
        View public page
      </Link>
    </div>
  );
}
