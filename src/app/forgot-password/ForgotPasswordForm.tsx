"use client";

import Link from "next/link";
import { useState } from "react";
import { requestPasswordResetAction } from "@/actions/password-reset.actions";
import { PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE } from "@/lib/auth/password-reset-messages";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await requestPasswordResetAction(email);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <AuthFormCard>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-black">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            {PASSWORD_RESET_GENERIC_SUCCESS_MESSAGE}
          </p>
        </div>
        <p className="text-center text-sm text-zinc-600">
          <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthFormCard>
    );
  }

  return (
    <AuthFormCard>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">Forgot password?</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          Enter your email address. If an account exists for that email, we&apos;ll send a password reset
          link.
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="oo-label">
            Email
          </label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="oo-input"
          />
        </div>
        {error && (
          <p className="oo-form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="border-t border-zinc-100 pt-4 text-center text-sm text-zinc-600">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthFormCard>
  );
}
