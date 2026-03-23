import { Suspense } from "react";
import Link from "next/link";
import { LoginIntentSelector } from "@/components/auth/LoginIntentSelector";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <Suspense fallback={<p className="text-center text-sm text-stone-500">Loading…</p>}>
        <LoginIntentSelector />
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-stone-500">
        <Link href="/" className="underline hover:text-stone-800">
          Back to Mennyu
        </Link>
      </p>
    </div>
  );
}
