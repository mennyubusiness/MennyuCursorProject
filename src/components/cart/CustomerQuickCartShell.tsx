"use client";

import type { ReactNode } from "react";
import { QuickCartProvider } from "@/components/cart/QuickCartContext";
import { QuickCartDrawer } from "@/components/cart/QuickCartDrawer";

export function CustomerQuickCartShell({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  return (
    <QuickCartProvider enabled={enabled}>
      {children}
      {enabled ? <QuickCartDrawer /> : null}
    </QuickCartProvider>
  );
}
