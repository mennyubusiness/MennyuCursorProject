"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DashboardCard } from "@/components/dashboard";
import { resendEmailVerificationAction } from "@/actions/email-verification.actions";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type AccountEmailVerificationCardProps = {
  email: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
};

export function AccountEmailVerificationCard({
  email,
  emailVerified,
  emailVerifiedAt,
}: AccountEmailVerificationCardProps) {
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
    <DashboardCard
      title="Email verification"
      description="Verifying your email helps protect your account and ensures important account messages reach you."
    >
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-oo-stone-gray">Email</dt>
          <dd className="mt-1 font-medium text-oo-charcoal">{email}</dd>
        </div>
        <div>
          <dt className="text-oo-stone-gray">Status</dt>
          <dd className="mt-1 font-medium text-oo-charcoal">
            {emailVerified ? "Email verified" : "Email not verified"}
          </dd>
          {emailVerified && emailVerifiedAt ? (
            <dd className="mt-1 text-xs text-oo-stone-gray">
              Verified {new Date(emailVerifiedAt).toLocaleString()}
            </dd>
          ) : null}
        </div>
      </dl>

      {!emailVerified ? (
        <div className="mt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => void resend()}
            className={cn(buttonClassName({ variant: "primary", size: "sm" }))}
          >
            {pending ? "Sending…" : "Send verification email"}
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="mt-3 text-sm font-medium text-emerald-700" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </DashboardCard>
  );
}
