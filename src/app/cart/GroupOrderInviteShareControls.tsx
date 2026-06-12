"use client";

import { useCallback, useState } from "react";
import { buildGroupOrderShareText } from "@/lib/group-order-invite-url";
import { GroupOrderInviteQrModal } from "@/components/group-order/GroupOrderInviteQrModal";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type Props = {
  joinCode: string;
  inviteAbsoluteUrl: string;
  podName: string;
  qrDataUrl: string;
  variant?: "default" | "compact";
};

const shareButtonClass = cn(
  buttonClassName({ variant: "outline", size: "sm" }),
  "min-h-10"
);

export function GroupOrderInviteShareControls({
  joinCode,
  inviteAbsoluteUrl,
  podName,
  qrDataUrl,
  variant = "default",
}: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const compact = variant === "compact";

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
    <div
      className={cn(
        compact
          ? ""
          : "mt-4 rounded-xl border border-stone-200 bg-stone-50/80 p-4"
      )}
    >
      <p
        className={cn(
          "font-semibold text-oo-charcoal",
          compact ? "text-sm" : "text-sm text-stone-900"
        )}
      >
        {compact ? "Invite friends" : "Invite people"}
      </p>
      <p className={cn("mt-1 text-xs", compact ? "text-oo-stone-gray" : "text-stone-600")}>
        {compact
          ? "Share this 6-digit code or link so friends can join."
          : "Friends can scan the QR code or enter this 6-digit code."}
      </p>
      <p
        className={cn(
          "font-mono font-bold tracking-[0.2em] text-oo-charcoal",
          compact ? "mt-3 text-2xl" : "mt-3 text-3xl text-stone-900"
        )}
        aria-label={`Group order code ${joinCode}`}
      >
        {joinCode}
      </p>
      {!compact && (
        <p className="mt-2 text-xs text-stone-600">
          Share this code or QR link with friends so they can join your group order. You&apos;ll pay for
          the group at checkout.
        </p>
      )}
      <div className={cn("flex flex-wrap gap-2", compact ? "mt-4" : "mt-4")}>
        <button type="button" onClick={() => void copyCode()} className={shareButtonClass}>
          {codeCopied ? "Code copied" : "Copy code"}
        </button>
        <button type="button" onClick={() => void copyLink()} className={shareButtonClass}>
          {linkCopied ? "Link copied" : "Copy link"}
        </button>
        <button type="button" onClick={() => setQrOpen(true)} className={shareButtonClass}>
          QR code
        </button>
        {canNativeShare ? (
          <button type="button" onClick={() => void shareInvite()} className={shareButtonClass}>
            Share
          </button>
        ) : null}
      </div>
      {shareError ? (
        <p className={cn("mt-2 text-xs text-amber-800", compact && "text-status-error")} role="alert">
          {shareError}
        </p>
      ) : null}

      {qrOpen ? (
        <GroupOrderInviteQrModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          joinCode={joinCode}
          inviteAbsoluteUrl={inviteAbsoluteUrl}
          podName={podName}
          qrDataUrl={qrDataUrl}
        />
      ) : null}
    </div>
  );
}
