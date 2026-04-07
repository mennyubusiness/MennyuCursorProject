import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?intent=customer&callbackUrl=${encodeURIComponent(ACCOUNT_ROLE_PATH)}`);
  }
  return <div className="mx-auto max-w-lg px-4 py-8">{children}</div>;
}
