import { Suspense } from "react";
import Link from "next/link";
import { LoginIntentSelector } from "@/components/auth/LoginIntentSelector";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Link
          href="/register"
          className="inline-flex w-full items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-stone-900 shadow-sm hover:bg-stone-50 sm:w-auto"
        >
          Create an account
        </Link>
        <Link
          href="/"
          className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-center text-sm text-stone-600 hover:text-stone-900 sm:w-auto"
        >
          Back to Mennyu
        </Link>
      </div>
      <Suspense fallback={<p className="text-center text-sm text-stone-500">Loading…</p>}>
        <LoginIntentSelector />
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-stone-500">
        New to Mennyu?{" "}
        <Link href="/register" className="font-medium text-mennyu-primary hover:underline">
          Register here
        </Link>
      </p>
    </div>
  );
}
