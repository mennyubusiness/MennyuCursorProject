"use client";

import { Suspense, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";

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

function buildCurrentReturnPath(
  pathname: string | null,
  searchParams: Pick<URLSearchParams, "toString"> | null
): string {
  if (!pathname) return "/";
  const search = searchParams?.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function CustomerSignOutFormInner(props: CustomerSignOutFormProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnPath = buildCurrentReturnPath(pathname, searchParams);
  const { onSignOutStart, children, className, role } = props;

  return (
    <form action={signOutAccountAction}>
      <input type="hidden" name="returnPath" value={returnPath} />
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

function CustomerSignOutFormFallback({
  onSignOutStart,
  children,
  className,
  role,
}: CustomerSignOutFormProps) {
  return (
    <form action={signOutAccountAction}>
      <input type="hidden" name="returnPath" value="/" />
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

/** Shared email-account sign-out — server action clears Auth.js session and redirects contextually. */
export function CustomerSignOutForm(props: CustomerSignOutFormProps) {
  return (
    <Suspense fallback={<CustomerSignOutFormFallback {...props} />}>
      <CustomerSignOutFormInner {...props} />
    </Suspense>
  );
}
