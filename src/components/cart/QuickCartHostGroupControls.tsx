"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { buildGroupOrderJoinPath, buildGroupOrderShareText } from "@/lib/group-order-invite-url";

type Props = {
  joinCode: string;
  podId: string;
  podName: string | null;
  onNavigate?: () => void;
};

export function QuickCartHostGroupControls({
  joinCode,
  podId,
  podName,
  onNavigate,
}: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const invitePath = buildGroupOrderJoinPath(joinCode);
  const inviteAbsoluteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${invitePath}`
      : invitePath;

  const copyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(joinCode);
      setCodeCopied(true);
      window.setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [joinCode]);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(inviteAbsoluteUrl);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [inviteAbsoluteUrl]);

  const shareInvite = useCallback(async () => {
    if (typeof navigator.share !== "function") return;
    try {
      await navigator.share({
        title: "Join my group order",
        text: buildGroupOrderShareText(podName?.trim() || "this pod", joinCode),
        url: inviteAbsoluteUrl,
      });
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }, [inviteAbsoluteUrl, joinCode, podName]);

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
      <p className="font-semibold text-oo-charcoal">Group cart created</p>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Invite friends to add their items, or start adding yours.
      </p>
      <p className="mt-3 font-mono text-xs text-oo-stone-gray">
        Code: <span className="font-semibold text-oo-charcoal">{joinCode}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void copyCode()}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          {codeCopied ? "Code copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          {linkCopied ? "Link copied" : "Copy link"}
        </button>
        <Link
          href="/cart#group-order-invite"
          onClick={onNavigate}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
        >
          QR code
        </Link>
        {canNativeShare ? (
          <button
            type="button"
            onClick={() => void shareInvite()}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Share
          </button>
        ) : null}
        <Link
          href={`/pod/${podId}`}
          onClick={onNavigate}
          className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/15"
        >
          Add items
        </Link>
        <Link
          href="/cart"
          onClick={onNavigate}
          className="rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/15"
        >
          Open group cart
        </Link>
      </div>
    </section>
  );
}
