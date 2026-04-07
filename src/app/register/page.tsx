import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user?.id) {
    const pending = await getPendingAccountSetupRedirect(session.user.id);
    redirect(pending ?? "/");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-8">
      <RegisterForm />
      <p className="text-center text-sm text-stone-500">
        <Link href="/" className="underline hover:text-stone-800">
          Back to Mennyu
        </Link>
      </p>
    </div>
  );
}
