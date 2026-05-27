import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    const pending = await getPendingAccountSetupRedirect(session.user.id);
    redirect(pending ?? "/");
  }

  return (
    <AuthShell>
      <RegisterForm />
      <p className="mt-8 text-center text-sm text-oo-stone-gray">
        <Link href="/" className="font-medium text-oo-charcoal underline-offset-4 hover:underline">
          ← Back to Open Order
        </Link>
      </p>
    </AuthShell>
  );
}
