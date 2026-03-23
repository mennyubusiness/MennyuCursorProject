import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<p className="text-sm text-stone-500">Loading…</p>}>
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
