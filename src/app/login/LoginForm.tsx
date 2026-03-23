"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

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

  const callbackUrl = safeCallbackPath(searchParams.get("callbackUrl"));

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
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-stone-900">Sign in</h1>
      <p className="text-sm text-stone-600">Use your Mennyu vendor account (email + password).</p>
      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-stone-700">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-stone-700">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
