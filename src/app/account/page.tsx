import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadAccountPageContext } from "@/lib/account-page-context";
import { resolveAccountPrimaryNavMode } from "@/lib/account-primary-nav-mode";
import { ACCOUNT_SIGN_IN_PATH } from "@/lib/auth/account-paths";
import { getOrdersForSignedInUser } from "@/services/customer-account-orders.service";

import { AccountHubHeader } from "./AccountHubHeader";
import { AccountPhoneSection } from "./AccountPhoneSection";
import { AccountProfileCard } from "./AccountProfileCard";
import { AccountRecentOrders } from "./AccountRecentOrders";
import { AccountSecurityCard } from "./AccountSecurityCard";
import { AccountSignOutSection } from "./AccountSignOutSection";
import { AccountToolsGrid } from "./AccountToolsGrid";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect(ACCOUNT_SIGN_IN_PATH);
  }

  const ctx = await loadAccountPageContext(await headers());
  const recentOrders = (
    await getOrdersForSignedInUser(session.user.id, session.user.email)
  ).slice(0, 3);

  const showPhoneLinkHint = Boolean(ctx.checkoutPhone?.canLink);
  const primaryMode = resolveAccountPrimaryNavMode(ctx);

  return (
    <div className="space-y-6">
      <AccountHubHeader ctx={ctx} primaryMode={primaryMode} />
      <AccountProfileCard email={session.user.email} name={ctx.emailAccount?.name ?? null} />
      {primaryMode === "customer" && (
        <>
          <AccountPhoneSection checkoutPhone={ctx.checkoutPhone} />
          <AccountRecentOrders orders={recentOrders} showPhoneLinkHint={showPhoneLinkHint} />
        </>
      )}
      <AccountSecurityCard email={session.user.email} />
      <AccountToolsGrid staff={ctx.staff} primaryMode={primaryMode} />
      <AccountSignOutSection />
    </div>
  );
}
