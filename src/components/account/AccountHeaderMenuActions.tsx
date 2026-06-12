"use client";

import Link from "next/link";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import {
  ACCOUNT_HUB_PATH,
  ORDER_HISTORY_PATH,
} from "@/lib/auth/account-paths";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import { cn } from "@/lib/cn";

type AccountHeaderMenuActionsProps = {
  accountMenu: HeaderAccountMenu;
  itemClassName: string;
  signOutClassName: string;
  dividerClassName?: string;
  itemRole?: string;
  onNavigate?: () => void;
  onSignOutStart?: () => void;
};

export function AccountHeaderMenuActions({
  accountMenu,
  itemClassName,
  signOutClassName,
  dividerClassName = "my-1 border-t border-oo-light-stone",
  itemRole,
  onNavigate,
  onSignOutStart,
}: AccountHeaderMenuActionsProps) {
  return (
    <>
      <Link
        href={ACCOUNT_HUB_PATH}
        role={itemRole}
        className={itemClassName}
        onClick={onNavigate}
      >
        View account
      </Link>
      <Link
        href={ORDER_HISTORY_PATH}
        role={itemRole}
        className={itemClassName}
        onClick={onNavigate}
      >
        Order history
      </Link>
      {accountMenu.adminDashboardHref && (
        <Link
          href={accountMenu.adminDashboardHref}
          role={itemRole}
          className={itemClassName}
          onClick={onNavigate}
        >
          Platform admin
        </Link>
      )}
      {accountMenu.vendorDashboardHref && accountMenu.vendorDashboardLabel && (
        <Link
          href={accountMenu.vendorDashboardHref}
          role={itemRole}
          className={itemClassName}
          onClick={onNavigate}
        >
          {accountMenu.vendorDashboardLabel}
        </Link>
      )}
      {accountMenu.podDashboardHref && accountMenu.podDashboardLabel && (
        <Link
          href={accountMenu.podDashboardHref}
          role={itemRole}
          className={itemClassName}
          onClick={onNavigate}
        >
          {accountMenu.podDashboardLabel}
        </Link>
      )}
      <div className={dividerClassName} aria-hidden />
      <CustomerSignOutForm
        onSignOutStart={onSignOutStart}
        className={cn(signOutClassName)}
        role={itemRole}
      />
    </>
  );
}
