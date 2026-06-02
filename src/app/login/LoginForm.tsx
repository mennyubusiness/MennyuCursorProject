"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Suspense, useMemo, useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { resolvePostLoginDestinationAction } from "./actions";

function safeCallbackPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  return t;
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrlRaw = searchParams.get("callbackUrl");
  const callbackPath = useMemo(() => safeCallbackPath(callbackUrlRaw), [callbackUrlRaw]);
  const isOrdersCallback = callbackPath === "/orders";
  const resetSuccess = searchParams.get("reset") === "success";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (!res || res.error) {
        setError("Invalid email or password.");
        return;
      }

      await getSession();

      const callbackForResolver = (() => {
        if (!callbackUrlRaw) return null;
        const safe = safeCallbackPath(callbackUrlRaw);
        return safe === "/" ? null : safe;
      })();

      const dest = await resolvePostLoginDestinationAction(callbackForResolver);

      if (dest.kind === "error") {
        setError(dest.message);
        return;
      }

      router.replace(dest.path);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormCard>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">Sign in</h1>
        {resetSuccess && (
          <p className="mt-2 text-sm text-emerald-700" role="status">
            Your password has been reset. Please sign in.
          </p>
        )}
        {isOrdersCallback && (
          <p className="mt-2 text-sm text-zinc-600">Sign in to view your order history.</p>
        )}
        {callbackPath !== "/" && !isOrdersCallback && (
          <p className="mt-2 text-sm text-zinc-600">
            After you sign in, you&apos;ll be sent to the right place for your account.
          </p>
        )}
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <div>
          <label htmlFor="login-email" className="oo-label">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="oo-input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="oo-label">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-brand underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="oo-input"
          />
        </div>
        {error && (
          <p className="oo-form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthFormCard>
  );
}

function LoginFormFallback() {
  return (
    <div className="oo-card animate-pulse p-8" role="status">
      <div className="h-6 w-32 rounded bg-oo-light-stone" />
      <div className="mt-6 space-y-4">
        <div className="h-10 rounded-lg bg-oo-cream" />
        <div className="h-10 rounded-lg bg-oo-cream" />
        <div className="h-11 rounded-lg bg-oo-light-stone" />
      </div>
      <p className="sr-only">Loading sign in…</p>
    </div>
  );
}

export function LoginForm() {
  return (
    <Suspense fallback={<LoginFormFallback />}>
      <LoginFormInner />
    </Suspense>
  );
}
