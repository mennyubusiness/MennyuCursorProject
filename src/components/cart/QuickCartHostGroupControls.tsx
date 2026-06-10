"use client";

import { useCallback, useState } from "react";
import { buildGroupOrderShareText } from "@/lib/group-order-invite-url";
import {
  buildQuickCartGroupInviteAbsoluteUrl,
  GroupOrderInviteQrModal,
} from "@/components/group-order/GroupOrderInviteQrModal";

type Props = {
  joinCode: string;
  podName: string | null;
};

export function QuickCartHostGroupControls({ joinCode, podName }: Props) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [inviteExpanded, setInviteExpanded] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const inviteAbsoluteUrl = buildQuickCartGroupInviteAbsoluteUrl(joinCode);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

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

  return (
    <>
      <section className="mb-4 rounded-xl border border-oo-light-stone bg-oo-cream/80 px-3 py-3 text-sm">
        <p className="font-semibold text-oo-charcoal">Group cart created</p>
        <p className="mt-2 font-mono text-xs text-oo-stone-gray">
          Code: <span className="font-semibold text-oo-charcoal">{joinCode}</span>
        </p>
        <p className="mt-2 text-xs text-oo-stone-gray">Invite friends to add their items.</p>
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
            onClick={() => setInviteExpanded((v) => !v)}
            aria-expanded={inviteExpanded}
            className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
          >
            Invite options {inviteExpanded ? "▴" : "▾"}
          </button>
        </div>
        {inviteExpanded ? (
          <div className="mt-3 border-t border-oo-light-stone/80 pt-3">
            <p className="text-[11px] text-oo-stone-gray">
              Friends can join with the code or QR link.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyLink()}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                {linkCopied ? "Link copied" : "Copy invite link"}
              </button>
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
              >
                Show QR code
              </button>
              {canNativeShare ? (
                <button
                  type="button"
                  onClick={() => void shareInvite()}
                  className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-oo-cream"
                >
                  Share
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
      <GroupOrderInviteQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        joinCode={joinCode}
        inviteAbsoluteUrl={inviteAbsoluteUrl}
        podName={podName?.trim() || "Group order"}
        overlayClassName="z-[120]"
      />
    </>
  );
}
