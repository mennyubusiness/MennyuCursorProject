"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import {
  ACCOUNT_HUB_PATH,
  ORDER_HISTORY_PATH,
} from "@/lib/auth/account-paths";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import { cn } from "@/lib/cn";

type AccountHeaderDropdownProps = {
  accountMenu: HeaderAccountMenu | null;
  hasServerSession: boolean;
  triggerClassName: string;
};

const menuPanelClass =
  "absolute right-0 top-full z-[60] mt-1.5 min-w-[14rem] max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E7E0D6] bg-[#FFFDF8] py-1.5 shadow-lg";

const menuItemClass =
  "block w-full px-3.5 py-2 text-left text-sm font-medium text-[#1F1F1C] transition-colors hover:bg-[#FAF4EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand";

export function AccountHeaderDropdown({
  accountMenu,
  hasServerSession,
  triggerClassName,
}: AccountHeaderDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!hasServerSession || !accountMenu) return null;

  const displayLabel = accountMenu.name?.trim() || accountMenu.email.split("@")[0] || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(triggerClassName, open && "border-oo-light-stone bg-oo-cream")}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        Account
        <span className="ml-0.5 text-[10px] opacity-70" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className={menuPanelClass} role="menu">
          <div className="border-b border-[#E7E0D6] px-3.5 py-2.5">
            <p className="truncate text-sm font-semibold text-[#1F1F1C]">{displayLabel}</p>
            <p className="truncate text-xs text-[#6B6560]">{accountMenu.email}</p>
            {accountMenu.roleHint && (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-brand">
                {accountMenu.roleHint}
              </p>
            )}
          </div>
          <Link
            href={ACCOUNT_HUB_PATH}
            role="menuitem"
            className={menuItemClass}
            onClick={close}
          >
            View account
          </Link>
          <Link
            href={ORDER_HISTORY_PATH}
            role="menuitem"
            className={menuItemClass}
            onClick={close}
          >
            Order history
          </Link>
          {accountMenu.adminDashboardHref && (
            <Link
              href={accountMenu.adminDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              Platform admin
            </Link>
          )}
          {accountMenu.vendorDashboardHref && accountMenu.vendorDashboardLabel && (
            <Link
              href={accountMenu.vendorDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              {accountMenu.vendorDashboardLabel}
            </Link>
          )}
          {accountMenu.podDashboardHref && accountMenu.podDashboardLabel && (
            <Link
              href={accountMenu.podDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              {accountMenu.podDashboardLabel}
            </Link>
          )}
          <div className="my-1 border-t border-[#E7E0D6]" />
          <CustomerSignOutForm
            onSignOutStart={close}
            className={cn(menuItemClass, "text-red-800 hover:bg-red-50")}
            role="menuitem"
          />
        </div>
      )}
    </div>
  );
}
