"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ensureVendorRegistrationIntentForInvite } from "@/actions/account-setup.actions";
import { buildLoginHrefWithReturn, buildRegisterHrefWithReturn } from "@/lib/auth/invite-auth-links";
import type { PodVendorInvitePublicView } from "@/services/pod-vendor-invite.types";

export function VendorInviteLanding({
  token,
  invite,
  signedIn,
  userEmail,
  initialEmailMismatch = null,
}: {
  token: string;
  invite: PodVendorInvitePublicView;
  signedIn: boolean;
  userEmail: string | null;
  initialEmailMismatch?: { invitedEmail: string; currentEmail: string } | null;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailMismatch, setEmailMismatch] = useState(initialEmailMismatch);
  const autoAcceptStarted = useRef(false);

  const invitePath = `/vendor/invite/${encodeURIComponent(token)}`;

  async function handleAccept() {
    setError(null);
    setEmailMismatch(null);
    setAccepting(true);
    try {
      const res = await fetch("/api/vendor/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        invitedEmail?: string;
        currentEmail?: string;
        redirectPath?: string;
      };

      if (!res.ok) {
        if (data.code === "email_mismatch" && data.invitedEmail && data.currentEmail) {
          setEmailMismatch({ invitedEmail: data.invitedEmail, currentEmail: data.currentEmail });
          return;
        }
        if (data.code === "no_vendor_account") {
          const intent = await ensureVendorRegistrationIntentForInvite(token);
          if (!intent.ok) {
            setError(intent.error);
            return;
          }
          router.push(`/account/setup/vendor?next=${encodeURIComponent(invitePath)}`);
          return;
        }
        setError(data.error ?? "Could not accept invite.");
        return;
      }

      const redirectPath = data.redirectPath ?? "/vendor/dashboard";
      router.push(redirectPath);
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  useEffect(() => {
    if (!signedIn || !invite.ok || invite.status !== "pending" || initialEmailMismatch) return;
    if (autoAcceptStarted.current) return;
    autoAcceptStarted.current = true;
    void handleAccept();
  }, [signedIn, invite, initialEmailMismatch]);

  if (!invite.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-oo-light-stone bg-oo-warm-white p-6">
        <h1 className="text-xl font-semibold text-oo-charcoal">Invite not available</h1>
        <p className="mt-2 text-sm text-oo-stone-gray">
          This invite link is not valid. Ask the pod owner to send you a new invite.
        </p>
      </div>
    );
  }

  if (invite.status !== "pending") {
    const message =
      invite.status === "expired"
        ? "This invite has expired. Ask the pod owner for a new invite."
        : invite.status === "cancelled"
          ? "This invite was cancelled. Ask the pod owner for a new invite."
          : "This invite has already been used.";

    return (
      <div className="mx-auto max-w-lg rounded-xl border border-oo-light-stone bg-oo-warm-white p-6">
        <h1 className="text-xl font-semibold text-oo-charcoal">Invite not available</h1>
        <p className="mt-2 text-sm text-oo-stone-gray">{message}</p>
      </div>
    );
  }

  const vendorLabel = invite.invitedVendorName ? ` for ${invite.invitedVendorName}` : "";

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-oo-light-stone bg-oo-cream/60 p-6 sm:p-8">
      <h1 className="text-xl font-semibold text-oo-charcoal">Join {invite.podName} on Open Order</h1>
      <p className="mt-2 text-sm text-oo-stone-gray">
        You&apos;ve been invited to join <span className="font-medium text-oo-charcoal">{invite.podName}</span>
        {vendorLabel}. Create or sign in to your vendor account to connect your business to this pod.
      </p>

      {emailMismatch ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This invite was sent to {emailMismatch.invitedEmail}. You are signed in as {emailMismatch.currentEmail}.
          Please sign in with the invited email to continue.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {signedIn ? (
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={accepting}
            className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {accepting ? "Connecting…" : "Accept invite"}
          </button>
        ) : (
          <>
            <Link
              href={buildRegisterHrefWithReturn(invitePath, "vendor")}
              className="block w-full rounded-lg bg-brand px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-brand-hover"
            >
              Create vendor account
            </Link>
            <Link
              href={buildLoginHrefWithReturn(invitePath)}
              className="block w-full rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-center text-sm font-medium text-oo-charcoal hover:bg-oo-cream"
            >
              Sign in
            </Link>
          </>
        )}
      </div>

      {signedIn && userEmail ? (
        <p className="mt-4 text-xs text-oo-stone-gray">Signed in as {userEmail}</p>
      ) : null}
    </div>
  );
}
