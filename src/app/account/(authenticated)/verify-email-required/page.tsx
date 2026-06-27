import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { ACCOUNT_SIGN_IN_PATH } from "@/lib/auth/account-paths";
import { isUserEmailVerified, loadUserEmailVerificationState } from "@/lib/auth/email-verification-access.server";
import { VerifyEmailRequiredClient } from "./VerifyEmailRequiredClient";

export default async function VerifyEmailRequiredPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(ACCOUNT_SIGN_IN_PATH);
  }

  const user = await loadUserEmailVerificationState(session.user.id);
  if (!user || isUserEmailVerified(user.emailVerified)) {
    redirect("/account");
  }

  return (
    <AuthShell>
      <VerifyEmailRequiredClient email={session.user.email} />
    </AuthShell>
  );
}
