"use client";

import { useCallback, useState } from "react";
import { buildGroupOrderShareText } from "@/lib/group-order-invite-url";

type Props = {
  joinCode: string;
  inviteAbsoluteUrl: string;
  podName: string;
  qrDataUrl: string;
};

export function GroupOrderInviteShareControls({
  joinCode,
  inviteAbsoluteUrl,
  podName,
  qrDataUrl,
}: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [joinCode]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteAbsoluteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [inviteAbsoluteUrl]);

  const shareInvite = useCallback(async () => {
    setShareError(null);
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "Join my group order",
        text: buildGroupOrderShareText(podName, joinCode),
        url: inviteAbsoluteUrl,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setShareError("Could not open share sheet.");
    }
  }, [inviteAbsoluteUrl, joinCode, podName]);

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-4">
      <p className="text-sm font-semibold text-stone-900">Invite people</p>
      <p className="mt-1 text-xs text-stone-600">
        Friends can scan the QR code or enter this 6-digit code.
      </p>
      <p
        className="mt-3 font-mono text-3xl font-bold tracking-[0.2em] text-stone-900"
        aria-label={`Group order code ${joinCode}`}
      >
        {joinCode}
      </p>
      <p className="mt-2 text-xs text-stone-600">
        Share this code or QR link with friends so they can join your group order. You&apos;ll pay for
        the group at checkout.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
        >
          {codeCopied ? "Code copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
        >
          {linkCopied ? "Invite link copied" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
        >
          QR code
        </button>
        {canNativeShare ? (
          <button
            type="button"
            onClick={() => void shareInvite()}
            className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
          >
            Share
          </button>
        ) : null}
      </div>
      {shareError ? <p className="mt-2 text-xs text-amber-800">{shareError}</p> : null}

      {qrOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-order-qr-title"
          onClick={() => setQrOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="group-order-qr-title" className="text-lg font-semibold text-stone-900">
              Scan to join group order
            </h3>
            <p className="mt-1 text-sm text-stone-600">{podName}</p>
            {qrDataUrl ? (
              <div className="mt-4 flex justify-center rounded-xl border border-stone-200 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL from server */}
                <img
                  src={qrDataUrl}
                  alt={`QR code to join group order at ${podName}`}
                  width={200}
                  height={200}
                  className="h-auto w-[200px] max-w-full"
                />
              </div>
            ) : (
              <p className="mt-4 text-sm text-amber-800">Could not load QR code. Copy the link instead.</p>
            )}
            <p className="mt-4 text-center font-mono text-sm font-semibold text-stone-800">
              Code: {joinCode}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-900 hover:bg-stone-100"
              >
                {linkCopied ? "Invite link copied" : "Copy link"}
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(false)}
                className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-semibold text-white hover:bg-stone-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
