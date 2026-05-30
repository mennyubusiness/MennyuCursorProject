import { redirect } from "next/navigation";
import { RegistrationIntent } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { ACCOUNT_SETUP_CUSTOMER_PATH } from "@/lib/auth/account-paths";
import { CustomerSetupForm } from "./CustomerSetupForm";

export default async function CustomerSetupPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const pending = await getPendingAccountSetupRedirect(session.user.id);
  if (pending && pending !== ACCOUNT_SETUP_CUSTOMER_PATH) {
    redirect(pending);
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { registrationIntent: true },
  });
  if (user?.registrationIntent !== RegistrationIntent.customer) {
    redirect("/");
  }

  return <CustomerSetupForm />;
}
