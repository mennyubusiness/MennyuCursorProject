"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  acceptPodClaimInviteAction,
  resendPodClaimEmailVerificationAction,
} from "@/actions/pod-claim.actions";
import { Button } from "@/components/ui/button";

export function PodClaimPanel({
  token,
  emailVerified,
}: {
  token: string;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function claim() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await acceptPodClaimInviteAction(token);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/pod/${result.podId}/dashboard?claimed=1`);
      router.refresh();
    });
  }

  function resendVerification() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await resendPodClaimEmailVerificationAction(token);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
    });
  }

  return (
    <div className="mt-6 space-y-3">
      {emailVerified ? (
        <Button type="button" disabled={pending} onClick={claim} className="w-full sm:w-auto">
          {pending ? "Claiming…" : "Claim pod"}
        </Button>
      ) : (
        <>
          <p className="text-sm text-oo-stone-gray">
            Verify your email, then return here to claim this pod.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={resendVerification}
            className="w-full sm:w-auto"
          >
            {pending ? "Sending…" : "Resend verification email"}
          </Button>
        </>
      )}
      {message ? <p className="text-sm font-medium text-emerald-700">{message}</p> : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
