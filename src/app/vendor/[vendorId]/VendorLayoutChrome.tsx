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

  if (isKitchen) {
    return <div className="min-h-dvh bg-oo-cream">{children}</div>;
  }

  return (
    <div className="oo-dash">
      <header className="oo-dash-titlebar">
        <div className="mx-auto max-w-2xl px-4 pb-2 pt-4">
          <h1 className="oo-dash-titlebar-heading">{vendorName}</h1>
        </div>
        <VendorAreaNav vendorId={vendorId} />
      </header>
      <main className="mx-auto max-w-2xl p-4">{children}</main>
    </div>
  );
}

/** Kitchen-only exit control (used inside kitchen page top bar). */
export function VendorKitchenExitLink({ vendorId }: { vendorId: string }) {
  return (
    <Link
      href={`/vendor/${vendorId}/orders`}
      className="rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal shadow-sm transition hover:bg-oo-cream"
    >
      Exit Kitchen Mode
    </Link>
  );
}
