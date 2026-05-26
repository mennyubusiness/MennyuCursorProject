"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useMemo, useState } from "react";
import { AuthFormCard } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { resolvePostLoginDestinationAction } from "./actions";

function safeCallbackPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  return t;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrlRaw = searchParams.get("callbackUrl");
  const callbackPath = useMemo(() => safeCallbackPath(callbackUrlRaw), [callbackUrlRaw]);

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
      if (res?.error) {
        setError("Invalid email or password.");
        return;
      }

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

      router.push(dest.path);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthFormCard>
      <div>
        <h1 className="text-2xl font-black tracking-tight text-black">Sign in</h1>
        {callbackPath !== "/" && (
          <p className="mt-2 text-sm text-zinc-600">
            After you continue, you&apos;ll be sent to the right place for your account.
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
          <label htmlFor="login-password" className="oo-label">
            Password
          </label>
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
          {loading ? "Signing in…" : "Continue"}
        </Button>
      </form>
    </AuthFormCard>
  );
}
