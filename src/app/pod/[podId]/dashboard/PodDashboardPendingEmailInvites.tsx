"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type PendingEmailInvite = {
  id: string;
  invitedEmail: string;
  invitedVendorName: string | null;
  invitedContactName: string | null;
  lastSentAt: string;
};

function formatInviteDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function PodDashboardPendingEmailInvites({
  podId,
  invites,
  className = "",
}: {
  podId: string;
  invites: PendingEmailInvite[];
  className?: string;
}) {
  const router = useRouter();
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inviteUrls, setInviteUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    setInviteUrls({});
  }, [invites]);

  if (invites.length === 0) return null;

  async function postAction(inviteId: string, action: "resend" | "cancel") {
    setError(null);
    setActingId(inviteId);
    try {
      const res = await fetch(`/api/pod/${podId}/vendor-invites/${inviteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; inviteUrl?: string };
      if (!res.ok) {
        setError(data.error ?? "Action failed.");
        return;
      }
      if (action === "resend" && data.inviteUrl) {
        setInviteUrls((prev) => ({ ...prev, [inviteId]: data.inviteUrl! }));
      }
      router.refresh();
    } finally {
      setActingId(null);
    }
  }

  async function copyLink(inviteId: string, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inviteId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError("Could not copy link.");
    }
  }

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Pending invites</h3>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <ul className="mt-3 space-y-2">
        {invites.map((invite) => {
          const label = invite.invitedVendorName?.trim() || invite.invitedEmail;
          const inviteUrl = inviteUrls[invite.id];
          return (
            <li
              key={invite.id}
              className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-3 text-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-oo-charcoal">{label}</p>
                  <p className="text-xs text-oo-stone-gray">
                    Invited · Email sent {formatInviteDate(invite.lastSentAt)}
                    {invite.invitedVendorName ? ` · ${invite.invitedEmail}` : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={actingId === invite.id}
                    onClick={() => void postAction(invite.id, "resend")}
                    className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1 text-xs font-medium text-oo-charcoal hover:bg-oo-cream disabled:opacity-50"
                  >
                    Resend
                  </button>
                  {inviteUrl ? (
                    <button
                      type="button"
                      onClick={() => void copyLink(invite.id, inviteUrl)}
                      className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1 text-xs font-medium text-oo-charcoal hover:bg-oo-cream"
                    >
                      {copiedId === invite.id ? "Copied!" : "Copy link"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={actingId === invite.id}
                    onClick={() => void postAction(invite.id, "cancel")}
                    className="rounded border border-oo-light-stone bg-oo-warm-white px-2 py-1 text-xs font-medium text-oo-stone-gray hover:bg-oo-cream disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
