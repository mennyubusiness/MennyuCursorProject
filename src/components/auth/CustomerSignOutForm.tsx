"use client";

import { useEffect } from "react";
import { useFormStatus } from "react-dom";

import { signOutAccountAction } from "@/app/account/actions";

type CustomerSignOutFormProps = {
  /** Called when sign-out submit starts (e.g. close a menu). Do not run before submit. */
  onSignOutStart?: () => void;
  children?: React.ReactNode;
  className?: string;
  role?: string;
};

function CustomerSignOutSubmit({
  onSignOutStart,
  children = "Sign out",
  className,
  role,
}: Omit<CustomerSignOutFormProps, "children"> & { children?: React.ReactNode }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) onSignOutStart?.();
  }, [pending, onSignOutStart]);

  return (
    <button type="submit" disabled={pending} className={className} role={role}>
      {pending ? "Signing out…" : children}
    </button>
  );
}

/** Shared email-account sign-out — server action clears Auth.js session and redirects to login. */
export function CustomerSignOutForm({
  onSignOutStart,
  children,
  className,
  role,
}: CustomerSignOutFormProps) {
  return (
    <form action={signOutAccountAction}>
      <CustomerSignOutSubmit
        onSignOutStart={onSignOutStart}
        className={className}
        role={role}
      >
        {children}
      </CustomerSignOutSubmit>
    </form>
  );
}
