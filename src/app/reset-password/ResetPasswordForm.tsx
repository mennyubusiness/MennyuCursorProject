"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { resetPasswordAction } from "@/actions/password-reset.actions";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password-policy";

function readResetTokenFromLocation(): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("token")?.trim() ?? "";
}

function ResetPasswordFormInner() {
  const router = useRouter();
  const tokenRef = useRef<string>(readResetTokenFromLocation());
  const token = tokenRef.current;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("This reset link is invalid or has expired. Request a new one.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordAction(token, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/login?reset=success");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthFormCard>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black">Reset password</h1>
          <p className="mt-3 text-sm text-zinc-600">
            This reset link is invalid or has expired. Request a new one.
          </p>
        </div>
        <p className="text-center text-sm text-zinc-600">
          <Link
            href="/forgot-password"
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            Request a new reset link
          </Link>
        </p>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">Reset password</h1>
        <p className="mt-2 text-sm text-zinc-600">Choose a new password for your Open Order account.</p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <input type="hidden" name="token" value={token} readOnly />
        <div>
          <label htmlFor="reset-password" className="oo-label">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="oo-input"
          />
          <p className="mt-1.5 text-xs text-zinc-500">Minimum {MIN_PASSWORD_LENGTH} characters</p>
        </div>
        <div>
          <label htmlFor="reset-password-confirm" className="oo-label">
            Confirm password
          </label>
          <input
            id="reset-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="oo-input"
          />
        </div>
        {error && (
          <p className="oo-form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Resetting…" : "Reset password"}
        </Button>
      </form>
    </AuthFormCard>
  );
}

function ResetPasswordFormFallback() {
  return (
    <div className="oo-card animate-pulse p-8" role="status">
      <div className="h-6 w-40 rounded bg-oo-light-stone" />
      <div className="mt-6 space-y-4">
        <div className="h-10 rounded-lg bg-oo-cream" />
        <div className="h-10 rounded-lg bg-oo-cream" />
        <div className="h-11 rounded-lg bg-oo-light-stone" />
      </div>
      <p className="sr-only">Loading reset form…</p>
    </div>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={<ResetPasswordFormFallback />}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
