import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { ACCOUNT_ROLE_PATH } from "@/lib/auth/account-paths";
import { RolePicker } from "./RolePicker";

export default async function AccountRolePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const pending = await getPendingAccountSetupRedirect(session.user.id);
  if (pending && pending !== ACCOUNT_ROLE_PATH) {
    redirect(pending);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { needsAccountRoleSelection: true },
  });

  if (!user?.needsAccountRoleSelection) {
    redirect("/");
  }

  return <RolePicker />;
}
