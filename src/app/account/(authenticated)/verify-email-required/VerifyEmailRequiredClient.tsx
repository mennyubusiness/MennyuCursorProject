"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resendEmailVerificationAction } from "@/actions/email-verification.actions";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export function VerifyEmailRequiredClient({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setPending(true);
    setMessage(null);
    setError(null);
    try {
      const result = await resendEmailVerificationAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(result.message);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthFormCard>
      <h1 className="text-2xl font-semibold text-oo-charcoal">Verify your email</h1>
      <p className="text-sm text-oo-stone-gray">
        This area requires a verified email address on your Open Order account.
      </p>
      <p className="text-sm text-oo-stone-gray">
        We sent a verification link to <span className="font-medium text-oo-charcoal">{email}</span>.
        Check your inbox, then return here after verifying.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={pending} onClick={() => void resend()}>
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
        <Link href="/account" className="inline-flex items-center text-sm font-semibold text-brand underline-offset-4 hover:underline">
          Back to account
        </Link>
      </div>
      {message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </AuthFormCard>
  );
}
