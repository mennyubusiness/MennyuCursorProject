"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { Z_BOTTOM_SHEET } from "@/lib/layout-z-index";
import { mobileSafeAreaBottomPadding } from "@/lib/mobile-sticky-cart-bar-classes";

export type MobileBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  description?: string;
  /** Extra classes on the overlay (e.g. z-index overrides). */
  overlayClassName?: string;
  /** Focus this selector on open. */
  initialFocusSelector?: string;
  /** Sheet panel width on desktop (centered modal). */
  panelClassName?: string;
};

export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  description,
  overlayClassName,
  initialFocusSelector,
  panelClassName,
}: MobileBottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      if (initialFocusSelector) {
        panelRef.current?.querySelector<HTMLElement>(initialFocusSelector)?.focus();
        return;
      }
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, initialFocusSelector]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center bg-oo-charcoal/45 backdrop-blur-sm sm:items-center sm:p-4",
        overlayClassName
      )}
      style={{ zIndex: Z_BOTTOM_SHEET }}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className={cn(
          "flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-oo-light-stone bg-oo-warm-white shadow-[0_16px_48px_rgba(31,31,28,0.2)] sm:max-h-[min(90dvh,40rem)] sm:rounded-2xl",
          panelClassName
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col border-b border-oo-light-stone">
          <div
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-oo-light-stone sm:hidden"
            aria-hidden
          />
          <div className="flex items-start gap-3 px-4 pb-3 pt-2 sm:px-5 sm:pb-4 sm:pt-4">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-oo-charcoal sm:text-xl">
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-oo-stone-gray">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-oo-light-stone bg-oo-cream text-oo-charcoal transition hover:bg-oo-warm-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              aria-label="Close"
            >
              <span className="text-2xl leading-none" aria-hidden>
                ×
              </span>
            </button>
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5",
            footer ? mobileSafeAreaBottomPadding : undefined
          )}
        >
          {children}
        </div>

        {footer ? <div className="shrink-0">{footer}</div> : null}
      </div>
    </div>,
    document.body
  );
}
