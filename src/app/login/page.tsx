import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Link
            href="/"
            className="text-2xl font-semibold tracking-tight text-black hover:text-mennyu-primary"
          >
            Mennyu
          </Link>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-stone-500">Loading…</p>}>
          <LoginForm />
        </Suspense>
        <p className="text-center text-sm text-stone-600">
          <Link href="/register" className="font-medium text-mennyu-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
