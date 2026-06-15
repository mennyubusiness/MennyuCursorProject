import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { mobileBottomActionBarContentPadClass } from "@/lib/mobile-sticky-cart-bar-classes";

type MobileCustomerPageShellProps = {
  children: ReactNode;
  className?: string;
  /** Reserve space for a fixed mobile bottom action bar. */
  withBottomActionBar?: boolean;
};

/** Customer-facing page wrapper with consistent mobile padding and optional bottom-bar clearance. */
export function MobileCustomerPageShell({
  children,
  className,
  withBottomActionBar = false,
}: MobileCustomerPageShellProps) {
  return (
    <div
      className={cn(
        "w-full",
        withBottomActionBar && mobileBottomActionBarContentPadClass,
        className
      )}
    >
      {children}
    </div>
  );
}
