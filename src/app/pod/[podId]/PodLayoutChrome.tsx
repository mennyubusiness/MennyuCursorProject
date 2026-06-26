"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { PodAreaNav } from "./PodAreaNav";

export function PodLayoutChrome({
  podId,
  podName,
  showPayouts = false,
  children,
}: {
  podId: string;
  podName: string;
  showPayouts?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isWideWorkspace =
    pathname?.includes(`/pod/${podId}/dashboard`) ||
    pathname?.includes(`/pod/${podId}/vendors`) ||
    pathname?.includes(`/pod/${podId}/analytics`) ||
    pathname?.includes(`/pod/${podId}/promote`) ||
    pathname?.includes(`/pod/${podId}/payouts`) ||
    pathname?.includes(`/pod/${podId}/setup`) ||
    pathname?.includes(`/pod/${podId}/settings`);

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
          <h1 className="oo-dash-titlebar-heading">{podName}</h1>
        </div>
        <PodAreaNav podId={podId} wide={isWideWorkspace} showPayouts={showPayouts} />
      </header>
      <main className={mainWidth}>{children}</main>
    </div>
  );
}

/** Kitchen-style exit not used for pods; kept for parity if needed later. */
export function PodDashboardBackLink({ podId, label = "Back to dashboard" }: { podId: string; label?: string }) {
  return (
    <Link
      href={`/pod/${podId}/dashboard`}
      className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
    >
      {label}
    </Link>
  );
}
