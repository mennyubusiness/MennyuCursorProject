import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";

/** Onboarding subroutes require a NextAuth user session. */
export default async function AccountAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(ACCOUNT_ROLE_PATH)}`);
  }
  return children;
}
