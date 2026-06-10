"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { buildGroupOrderJoinPath } from "@/lib/group-order-invite-url";

type Props = {
  open: boolean;
  onClose: () => void;
  joinCode: string;
  inviteAbsoluteUrl: string;
  podName: string;
  /** Pre-rendered QR (full cart SSR). Generated client-side when omitted. */
  qrDataUrl?: string;
  overlayClassName?: string;
};

export function GroupOrderInviteQrModal({
  open,
  onClose,
  joinCode,
  inviteAbsoluteUrl,
  podName,
  qrDataUrl: qrDataUrlProp,
  overlayClassName = "z-50",
}: Props) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(qrDataUrlProp ?? "");
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (qrDataUrlProp) {
      setQrDataUrl(qrDataUrlProp);
      setQrError(false);
      return;
    }
    let cancelled = false;
    setQrError(false);
    void QRCode.toDataURL(inviteAbsoluteUrl, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#1c1917ff", light: "#ffffffff" },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, inviteAbsoluteUrl, qrDataUrlProp]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteAbsoluteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [inviteAbsoluteUrl]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-center justify-center bg-stone-900/50 p-4 ${overlayClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="group-order-qr-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="group-order-qr-title" className="text-lg font-semibold text-stone-900">
          Scan to join group order
        </h3>
        {podName ? <p className="mt-1 text-sm text-stone-600">{podName}</p> : null}
        {qrDataUrl && !qrError ? (
          <div className="mt-4 flex justify-center rounded-xl border border-stone-200 bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
            <img
              src={qrDataUrl}
              alt={podName ? `QR code to join group order at ${podName}` : "QR code to join group order"}
              width={200}
              height={200}
              className="h-auto w-[200px] max-w-full"
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-amber-800">Could not load QR code. Copy the link instead.</p>
        )}
        <p className="mt-4 text-center font-mono text-sm font-semibold text-stone-800">Code: {joinCode}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyLink()}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            {linkCopied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Client-safe invite URL for QR encoding (code-only join path). */
export function buildQuickCartGroupInviteAbsoluteUrl(joinCode: string): string {
  const path = buildGroupOrderJoinPath(joinCode);
  if (typeof window === "undefined") return path;
  return `${window.location.origin}${path}`;
}
