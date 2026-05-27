import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./LoginForm";

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

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-oo-stone-gray">
        New to Open Order?{" "}
        <Link
          href="/register"
          className="font-semibold text-brand underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
