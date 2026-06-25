import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./RegisterForm";

function RegisterFormFallback() {
  return (
    <div className="oo-card animate-pulse p-8" role="status">
      <div className="h-6 w-40 rounded bg-oo-light-stone" />
      <p className="sr-only">Loading registration…</p>
    </div>
  );
}

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    const pending = await getPendingAccountSetupRedirect(session.user.id);
    redirect(pending ?? "/");
  }

  return (
    <AuthShell>
      <Suspense fallback={<RegisterFormFallback />}>
        <RegisterForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-oo-stone-gray">
        <Link href="/" className="font-medium text-oo-charcoal underline-offset-4 hover:underline">
          ← Back to Open Order
        </Link>
      </p>
    </AuthShell>
  );
}
