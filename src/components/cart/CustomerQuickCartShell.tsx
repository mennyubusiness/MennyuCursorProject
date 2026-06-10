"use client";

import type { ReactNode } from "react";
import { QuickCartProvider } from "@/components/cart/QuickCartContext";
import { QuickCartDrawer } from "@/components/cart/QuickCartDrawer";

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
    <QuickCartProvider enabled={enabled} hasServerSession={hasServerSession}>
      {children}
      <QuickCartDrawer />
    </QuickCartProvider>
  );
}
