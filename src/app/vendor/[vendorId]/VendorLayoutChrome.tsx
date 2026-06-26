"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { VendorAreaNav } from "./VendorAreaNav";

export function VendorLayoutChrome({
  vendorId,
  vendorName,
  children,
}: {
  vendorId: string;
  vendorName: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isKitchen = pathname?.includes(`/vendor/${vendorId}/kitchen`);
  const isSettings = pathname?.includes(`/vendor/${vendorId}/settings`);
  const isWideWorkspace =
    isSettings ||
    pathname?.includes(`/vendor/${vendorId}/dashboard`) ||
    pathname?.includes(`/vendor/${vendorId}/orders`) ||
    pathname?.includes(`/vendor/${vendorId}/menu`) ||
    pathname?.includes(`/vendor/${vendorId}/menu-imports`) ||
    pathname?.includes(`/vendor/${vendorId}/hours`) ||
    pathname?.includes(`/vendor/${vendorId}/payouts`) ||
    pathname?.includes(`/vendor/${vendorId}/setup`);

  if (isKitchen) {
    return <div className="min-h-dvh bg-oo-cream">{children}</div>;
  }

  const headerWidth = isWideWorkspace
    ? "mx-auto max-w-7xl px-4 pb-2 pt-4"
    : "mx-auto max-w-2xl px-4 pb-2 pt-4";
  const mainWidth = isWideWorkspace
    ? "mx-auto w-full max-w-7xl px-4 py-6"
    : "mx-auto max-w-2xl p-4";

  return (
    <div className="oo-dash">
      <header className="oo-dash-titlebar">
        <div className={headerWidth}>
          <h1 className="oo-dash-titlebar-heading">{vendorName}</h1>
        </div>
        <VendorAreaNav vendorId={vendorId} wide={isWideWorkspace} />
      </header>
      <main className={mainWidth}>{children}</main>
    </div>
  );
}

/** Kitchen-only exit control (used inside kitchen page top bar). */
export function VendorKitchenExitLink({ vendorId }: { vendorId: string }) {
  return (
    <Link
      href={`/vendor/${vendorId}/dashboard`}
      className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal shadow-sm transition hover:bg-oo-cream"
    >
      Exit Kitchen Mode
    </Link>
  );
}
