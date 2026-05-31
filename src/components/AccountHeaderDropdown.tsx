"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { signOutAccountAction } from "@/app/account/actions";
import {
  ACCOUNT_HUB_PATH,
  ORDER_HISTORY_PATH,
} from "@/lib/auth/account-paths";
import type { HeaderAccountMenu } from "@/lib/auth/header-account-menu";
import { cn } from "@/lib/cn";

type AccountHeaderDropdownProps = {
  accountMenu: HeaderAccountMenu | null;
  triggerClassName: string;
};

const menuPanelClass =
  "absolute right-0 top-full z-[60] mt-1.5 min-w-[14rem] max-w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#E7E0D6] bg-[#FFFDF8] py-1.5 shadow-lg";

const menuItemClass =
  "block w-full px-3.5 py-2 text-left text-sm font-medium text-[#1F1F1C] transition-colors hover:bg-[#FAF4EA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand";

function SignOutMenuItem({ onClose }: { onClose: () => void }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      role="menuitem"
      disabled={pending}
      className={cn(menuItemClass, "text-red-800 hover:bg-red-50")}
      onClick={onClose}
    >
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}

function resolveMenu(
  accountMenu: HeaderAccountMenu | null,
  sessionEmail: string | null | undefined,
  sessionName: string | null | undefined
): HeaderAccountMenu | null {
  if (accountMenu) return accountMenu;
  if (!sessionEmail) return null;
  return {
    email: sessionEmail,
    name: sessionName?.trim() || null,
    roleHint: null,
    adminDashboardHref: null,
    vendorDashboardHref: null,
    vendorDashboardLabel: null,
    podDashboardHref: null,
    podDashboardLabel: null,
  };
}

export function AccountHeaderDropdown({
  accountMenu,
  triggerClassName,
}: AccountHeaderDropdownProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const menu = resolveMenu(accountMenu, session?.user?.email, session?.user?.name);

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

  if (!menu) return null;

  const displayLabel = menu.name?.trim() || menu.email.split("@")[0] || "Account";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(triggerClassName, open && "bg-[#FAF4EA]")}
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
            <p className="truncate text-xs text-[#6B6560]">{menu.email}</p>
            {menu.roleHint && (
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-brand">
                {menu.roleHint}
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
          {menu.adminDashboardHref && (
            <Link
              href={menu.adminDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              Platform admin
            </Link>
          )}
          {menu.vendorDashboardHref && menu.vendorDashboardLabel && (
            <Link
              href={menu.vendorDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              {menu.vendorDashboardLabel}
            </Link>
          )}
          {menu.podDashboardHref && menu.podDashboardLabel && (
            <Link
              href={menu.podDashboardHref}
              role="menuitem"
              className={menuItemClass}
              onClick={close}
            >
              {menu.podDashboardLabel}
            </Link>
          )}
          <div className="my-1 border-t border-[#E7E0D6]" />
          <form action={signOutAccountAction}>
            <SignOutMenuItem onClose={close} />
          </form>
        </div>
      )}
    </div>
  );
}
