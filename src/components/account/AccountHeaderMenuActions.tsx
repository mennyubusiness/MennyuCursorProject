"use client";

import Link from "next/link";

import { CustomerSignOutForm } from "@/components/auth/CustomerSignOutForm";
import type { RoleAccountAction } from "@/lib/auth/role-nav-items";
import { cn } from "@/lib/cn";

type AccountHeaderMenuActionsProps = {
  actions: RoleAccountAction[];
  itemClassName: string;
  signOutClassName: string;
  dividerClassName?: string;
  itemRole?: string;
  onNavigate?: () => void;
  onSignOutStart?: () => void;
};

export function AccountHeaderMenuActions({
  actions,
  itemClassName,
  signOutClassName,
  dividerClassName = "my-1 border-t border-oo-light-stone",
  itemRole,
  onNavigate,
  onSignOutStart,
}: AccountHeaderMenuActionsProps) {
  const linkActions = actions.filter((action): action is Extract<RoleAccountAction, { type: "link" }> => action.type === "link");
  const signOutAction = actions.find((action) => action.type === "sign-out");

  return (
    <>
      {linkActions.map((action) => (
        <Link
          key={`${action.href}-${action.label}`}
          href={action.href}
          role={itemRole}
          className={cn(itemClassName, action.danger && "text-red-800 hover:bg-red-50")}
          onClick={onNavigate}
        >
          {action.label}
        </Link>
      ))}
      <div className={dividerClassName} aria-hidden />
      <CustomerSignOutForm
        onSignOutStart={onSignOutStart}
        className={cn(signOutClassName, signOutAction?.danger && "text-red-800 hover:bg-red-50")}
        role={itemRole}
      >
        {signOutAction?.label ?? "Sign out"}
      </CustomerSignOutForm>
    </>
  );
}
