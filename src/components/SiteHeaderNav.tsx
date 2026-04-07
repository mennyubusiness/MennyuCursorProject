"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useCallback, useState } from "react";

type SiteHeaderNavProps = {
  /** Path for login callback (usually current path from middleware). */
  callbackPath: string;
  customerPhone: string | null;
  /** Server snapshot: user has a NextAuth session (vendor/admin). */
  hasServerSession: boolean;
  activeOrderHref: string | null;
  cartHref: string;
};

function buildLoginHref(callbackPath: string): string {
  const safe =
    callbackPath && callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/";
  const q = new URLSearchParams();
  q.set("intent", "customer");
  q.set("callbackUrl", safe);
  return `/login?${q.toString()}`;
}

export function SiteHeaderNav({
  callbackPath,
  customerPhone,
  hasServerSession,
  activeOrderHref,
  cartHref,
}: SiteHeaderNavProps) {
  const router = useRouter();
  const { status } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const hasPhoneSession = Boolean(customerPhone);
  const hasNextAuthSession =
    hasServerSession || status === "authenticated";
  const isSignedIn = hasPhoneSession || hasNextAuthSession;

  const loginHref = buildLoginHref(callbackPath);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await fetch("/api/orders/clear-phone", { method: "POST" });
      if (hasServerSession || status === "authenticated") {
        await signOut({ callbackUrl: "/" });
        return;
      }
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }, [hasServerSession, router, status]);

  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm sm:gap-x-6 sm:text-base">
      <Link href="/explore" className="text-stone-600 hover:text-mennyu-primary">
        Explore pods
      </Link>
      <Link
        href="/orders"
        className="text-stone-600 hover:text-mennyu-primary"
        title="Your orders — link your phone from checkout to see history"
      >
        Orders
      </Link>
      <Link
        href={activeOrderHref ?? cartHref}
        className="text-stone-600 hover:text-mennyu-primary"
      >
        Cart
      </Link>
      {!isSignedIn && (
        <>
          <Link
            href="/register"
            className="font-medium text-stone-700 hover:text-mennyu-primary hover:underline"
          >
            Register
          </Link>
          <Link
            href={loginHref}
            className="font-medium text-mennyu-primary hover:underline"
            title="Email sign-in (staff accounts). For order history, use Orders and your phone number."
          >
            Sign in
          </Link>
        </>
      )}
      {isSignedIn && (
        <button
          type="button"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          className="text-stone-600 hover:text-mennyu-primary disabled:opacity-50"
          title="Clears saved phone for orders and signs out email if you used one"
        >
          {signingOut ? "Signing out…" : "Sign out"}
        </button>
      )}
      <Link href="/admin" className="text-stone-500 hover:text-mennyu-primary">
        Admin
      </Link>
    </nav>
  );
}
