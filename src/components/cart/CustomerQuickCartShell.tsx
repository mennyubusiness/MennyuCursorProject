"use client";

import type { ReactNode } from "react";
import { QuickCartProvider } from "@/components/cart/QuickCartContext";
import { QuickCartDrawer } from "@/components/cart/QuickCartDrawer";
import { CurrentPagePodProvider } from "@/components/pod/CurrentPagePodProvider";

export function CustomerQuickCartShell({
  enabled,
  hasServerSession = false,
  children,
}: {
  enabled: boolean;
  hasServerSession?: boolean;
  children: ReactNode;
}) {
  return (
    <CurrentPagePodProvider>
      <QuickCartProvider enabled={enabled} hasServerSession={hasServerSession}>
        {children}
        <QuickCartDrawer />
      </QuickCartProvider>
    </CurrentPagePodProvider>
  );
}
