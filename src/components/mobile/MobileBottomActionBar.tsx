"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  mobileBottomActionBarFixedClass,
  mobileBottomActionBarInnerClass,
  mobileBottomActionBarInsetClass,
} from "@/lib/mobile-sticky-cart-bar-classes";

export type MobileBottomActionBarProps = {
  primaryLabel: string;
  onPrimaryClick?: () => void;
  primaryHref?: string;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  primaryType?: "button" | "submit";
  form?: string;
  summaryTitle?: string;
  summarySubtitle?: string;
  priceLabel?: string;
  secondaryAction?: ReactNode;
  className?: string;
  innerClassName?: string;
  /** Hide on lg+ (default true). */
  mobileOnly?: boolean;
  /** Fixed to viewport bottom (default true). Use false for in-sheet footers. */
  fixed?: boolean;
  "aria-label"?: string;
};

function PrimaryControl({
  primaryLabel,
  onPrimaryClick,
  primaryHref,
  primaryDisabled,
  primaryLoading,
  primaryType = "button",
  form,
  className,
  ariaLabel,
}: Pick<
  MobileBottomActionBarProps,
  | "primaryLabel"
  | "onPrimaryClick"
  | "primaryHref"
  | "primaryDisabled"
  | "primaryLoading"
  | "primaryType"
  | "form"
  | "aria-label"
> & { className?: string; ariaLabel?: string }) {
  const shared = cn(
    buttonClassName({ variant: "primary", size: "touch" }),
    "w-full shrink-0 sm:w-auto sm:min-w-[10rem]",
    className
  );

  if (primaryHref) {
    return (
      <Link
        href={primaryHref}
        className={shared}
        aria-label={ariaLabel ?? primaryLabel}
        aria-disabled={primaryDisabled}
      >
        {primaryLoading ? "Loading…" : primaryLabel}
      </Link>
    );
  }

  return (
    <button
      type={primaryType}
      form={form}
      onClick={onPrimaryClick}
      disabled={primaryDisabled || primaryLoading}
      aria-busy={primaryLoading}
      aria-label={ariaLabel ?? primaryLabel}
      className={shared}
    >
      {primaryLoading ? "Loading…" : primaryLabel}
    </button>
  );
}

export function MobileBottomActionBar({
  primaryLabel,
  onPrimaryClick,
  primaryHref,
  primaryDisabled = false,
  primaryLoading = false,
  primaryType = "button",
  form,
  summaryTitle,
  summarySubtitle,
  priceLabel,
  secondaryAction,
  className,
  innerClassName,
  mobileOnly = true,
  fixed = true,
  "aria-label": ariaLabel,
}: MobileBottomActionBarProps) {
  const hasSummary = Boolean(summaryTitle || summarySubtitle || priceLabel);

  return (
    <div
      className={cn(
        fixed ? mobileBottomActionBarFixedClass : mobileBottomActionBarInsetClass,
        mobileOnly && "lg:hidden",
        className
      )}
      role="region"
      aria-label={ariaLabel ?? "Primary action"}
    >
      <div className={cn(mobileBottomActionBarInnerClass, innerClassName)}>
        {hasSummary ? (
          <div className="min-w-0 flex-1">
            {summaryTitle ? (
              <p className="truncate text-sm font-bold text-oo-charcoal">{summaryTitle}</p>
            ) : null}
            {priceLabel ? (
              <p className="text-lg font-bold tabular-nums text-oo-charcoal">{priceLabel}</p>
            ) : null}
            {summarySubtitle ? (
              <p className="truncate text-sm text-oo-charcoal/70">{summarySubtitle}</p>
            ) : null}
          </div>
        ) : null}

        <div
          className={cn(
            "flex shrink-0 items-center gap-2",
            hasSummary ? "max-w-[55%]" : "w-full justify-stretch"
          )}
        >
          {secondaryAction}
          <PrimaryControl
            primaryLabel={primaryLabel}
            onPrimaryClick={onPrimaryClick}
            primaryHref={primaryHref}
            primaryDisabled={primaryDisabled}
            primaryLoading={primaryLoading}
            primaryType={primaryType}
            form={form}
            ariaLabel={ariaLabel}
            className={!hasSummary ? "flex-1" : undefined}
          />
        </div>
      </div>
    </div>
  );
}
