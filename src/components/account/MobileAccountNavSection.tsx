"use client";

import { AccountHeaderMenuActions } from "@/components/account/AccountHeaderMenuActions";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import { getHeaderAccountDisplayLabel } from "@/lib/auth/header-account-menu";
import { cn } from "@/lib/cn";

const headerFocusVisible =
  "outline-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const mobileNavRowBase = cn(
  "flex min-h-11 items-center rounded-xl px-4 py-2.5 text-base font-medium transition-colors duration-200",
  headerFocusVisible
);

const mobileNavRowIdle = "text-oo-charcoal hover:bg-oo-cream";

const mobileActionRow = cn(mobileNavRowBase, mobileNavRowIdle, "w-full justify-start");

type MobileAccountNavSectionProps = {
  accountMenu: HeaderAccountMenu | null;
  hasServerSession: boolean;
  onNavigate?: () => void;
};

export function MobileAccountNavSection({
  accountMenu,
  hasServerSession,
  onNavigate,
}: MobileAccountNavSectionProps) {
  if (!hasServerSession || !accountMenu) return null;

  const displayLabel = getHeaderAccountDisplayLabel(accountMenu);

  return (
    <section className="flex flex-col gap-1" aria-label="Account">
      <div className="rounded-xl px-4 py-2.5">
        <p className="truncate text-base font-semibold text-oo-charcoal">{displayLabel}</p>
        <p className="truncate text-sm text-oo-charcoal/70">{accountMenu.email}</p>
        {accountMenu.roleHint && (
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-brand">
            {accountMenu.roleHint}
          </p>
        )}
      </div>

      <AccountHeaderMenuActions
        accountMenu={accountMenu}
        itemClassName={mobileActionRow}
        signOutClassName={cn(mobileActionRow, "text-red-800 hover:bg-red-50")}
        onNavigate={onNavigate}
        onSignOutStart={onNavigate}
      />
    </section>
  );
}
