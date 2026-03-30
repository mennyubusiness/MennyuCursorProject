"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { resolvePostLoginDestinationAction } from "./actions";
import { resolveLoginIntent, type LoginIntent } from "@/lib/auth/login-intent";

function safeCallbackPath(raw: string | null): string {
  if (!raw || typeof raw !== "string") return "/";
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return "/";
  return t;
}

function formCopy(intent: LoginIntent): { title: string; blurb: string; button: string } {
  switch (intent) {
    case "vendor":
      return {
        title: "Sign in",
        blurb: "Use the email and password for your restaurant team account.",
        button: "Sign in to vendor",
      };
    case "pod":
      return {
        title: "Sign in",
        blurb: "Use the account your team uses for Mennyu. Pod overview and settings open after sign-in when your access is enabled.",
        button: "Sign in",
      };
    case "customer":
      return {
        title: "Sign in",
        blurb:
          "If you have a Mennyu email login, you can sign in here. Afterward we take you to Your orders—where you link your checkout phone number to see past orders. (Restaurant staff usually choose Vendor instead.)",
        button: "Continue to your orders",
      };
    case "admin":
      return {
        title: "Sign in",
        blurb: "Restaurant login does not open Mennyu internal tools. You can sign in below to confirm your account.",
        button: "Sign in",
      };
  }
}

type AfterLogin =
  | { kind: "idle" }
  | { kind: "notice"; variant: "no_access" | "coming_soon"; headline: string; body: string };

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [afterLogin, setAfterLogin] = useState<AfterLogin>({ kind: "idle" });

  const callbackUrlRaw = searchParams.get("callbackUrl");
  const callbackPath = useMemo(() => safeCallbackPath(callbackUrlRaw), [callbackUrlRaw]);
  const intent = useMemo(
    () => resolveLoginIntent(searchParams.get("intent"), callbackPath),
    [searchParams, callbackPath]
  );
  const copy = formCopy(intent);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAfterLogin({ kind: "idle" });
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

      const dest = await resolvePostLoginDestinationAction(intent, callbackForResolver);

      if (dest.kind === "error") {
        setError(dest.message);
        return;
      }

      if (dest.kind === "redirect") {
        router.push(dest.path);
        router.refresh();
        return;
      }

      if (dest.kind === "no_access" || dest.kind === "coming_soon") {
        setAfterLogin({
          kind: "notice",
          variant: dest.kind === "no_access" ? "no_access" : "coming_soon",
          headline: dest.headline,
          body: dest.body,
        });
        setPassword("");
        router.refresh();
        return;
      }
    } finally {
      setLoading(false);
    }
  }

  if (afterLogin.kind === "notice") {
    return (
      <div className="mx-auto max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
        <div
          className={
            afterLogin.variant === "no_access"
              ? "rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950"
              : "rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950"
          }
          role="status"
        >
          <p className="font-semibold text-stone-900">{afterLogin.headline}</p>
          <p className="mt-2 text-sm text-stone-700">{afterLogin.body}</p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <button
            type="button"
            className="rounded-lg border border-stone-300 bg-white py-2 font-medium text-stone-800 hover:bg-stone-50"
            onClick={() => void signOut({ redirect: false }).then(() => setAfterLogin({ kind: "idle" }))}
          >
            Sign out and try again
          </button>
          <button
            type="button"
            className="text-stone-600 underline hover:text-stone-900"
            onClick={() => setAfterLogin({ kind: "idle" })}
          >
            Stay signed in — back to form
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-lg font-semibold text-stone-900">{copy.title}</h1>
      <p className="text-sm text-stone-600">{copy.blurb}</p>
      {callbackPath !== "/" && (
        <p className="text-xs text-stone-500">
          After sign-in we&apos;ll send you to the right place if your account has access.
        </p>
      )}
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
        {loading ? "Signing in…" : copy.button}
      </button>
    </form>
  );
}
