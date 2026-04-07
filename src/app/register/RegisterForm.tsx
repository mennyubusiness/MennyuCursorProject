"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { registerWithEmailPassword } from "@/actions/register.actions";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";

export function RegisterForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const password = String(fd.get("password") ?? "");
    const name = String(fd.get("name") ?? "").trim();
    setLoading(true);
    try {
      const reg = await registerWithEmailPassword({
        email,
        password,
        name: name || undefined,
      });
      if (!reg.ok) {
        setError(reg.error);
        return;
      }
      const sign = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (sign?.error) {
        setError("Account created but sign-in failed. Try signing in from the login page.");
        return;
      }
      router.push(ACCOUNT_ROLE_PATH);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto max-w-sm space-y-4 rounded-lg border border-stone-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h1 className="text-lg font-semibold text-stone-900">Create your Mennyu account</h1>
        <p className="mt-1 text-sm text-stone-600">
          You’ll choose whether you’re ordering, running a restaurant, or managing a pod on the next step.
        </p>
      </div>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Name (optional)</span>
        <input
          name="name"
          autoComplete="name"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-stone-800">Password (min 8 characters)</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded border border-stone-300 px-3 py-2 text-sm"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-stone-900 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? "Creating account…" : "Continue"}
      </button>
      <p className="text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-mennyu-primary underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
