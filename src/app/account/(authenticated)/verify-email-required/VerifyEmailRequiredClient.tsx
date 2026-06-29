"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { resendEmailVerificationAction } from "@/actions/email-verification.actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

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
    <div className="mx-auto w-full max-w-md lg:max-w-none">
      <h1 className="text-2xl font-black tracking-tight text-oo-charcoal sm:text-[1.65rem]">
        Verify your email
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-oo-stone-gray sm:text-base">
        This area requires a verified email address on your Open Order account.
      </p>

      <div className="mt-6 rounded-xl border border-oo-light-stone bg-oo-cream/40 px-4 py-3.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Verification sent to
        </p>
        <p className="mt-1 break-all text-base font-semibold text-oo-charcoal">{email}</p>
        <p className="mt-2 text-sm text-oo-stone-gray">
          Check your inbox, then return here after verifying.
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="button"
          disabled={pending}
          onClick={() => void resend()}
          className={cn("w-full sm:w-auto sm:min-w-[12rem]")}
        >
          {pending ? "Sending…" : "Resend verification email"}
        </Button>
        <Link
          href="/account"
          className="inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-brand underline-offset-4 hover:underline sm:w-auto sm:justify-start"
        >
          Back to account
        </Link>
      </div>

      {message ? (
        <p className="mt-4 text-sm font-medium text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
