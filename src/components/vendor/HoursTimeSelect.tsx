"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import {
  formatVendorHoursTimeLabel,
  snapVendorHoursTimeToOption,
  VENDOR_HOURS_TIME_OPTIONS,
} from "@/lib/vendor-hours-time-options";

const MENU_MAX_HEIGHT = 240;
const MENU_Z_INDEX = 70;

type MenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
};

type HoursTimeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  "aria-label": string;
  className?: string;
  disabled?: boolean;
};

function computeMenuPosition(trigger: DOMRect): MenuPosition {
  const gap = 6;
  const viewportPadding = 8;
  const width = Math.max(trigger.width, 148);
  let left = trigger.left;
  if (left + width > window.innerWidth - viewportPadding) {
    left = Math.max(viewportPadding, window.innerWidth - viewportPadding - width);
  }
  left = Math.max(viewportPadding, left);

  const spaceBelow = window.innerHeight - trigger.bottom - viewportPadding;
  const spaceAbove = trigger.top - viewportPadding;
  const openAbove = spaceBelow < MENU_MAX_HEIGHT && spaceAbove > spaceBelow;
  const maxHeight = Math.min(
    MENU_MAX_HEIGHT,
    openAbove ? Math.max(120, spaceAbove - gap) : Math.max(120, spaceBelow - gap)
  );

  const top = openAbove ? trigger.top - gap - maxHeight : trigger.bottom + gap;

  return { top, left, width, maxHeight, placement: openAbove ? "above" : "below" };
}

export function HoursTimeSelect({
  value,
  onChange,
  "aria-label": ariaLabel,
  className,
  disabled = false,
}: HoursTimeSelectProps) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const displayValue = snapVendorHoursTimeToOption(value);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (VENDOR_HOURS_TIME_OPTIONS.includes(value)) return;
    onChange(snapVendorHoursTimeToOption(value));
  }, [value, onChange]);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    if (!trigger) return;
    setPosition(computeMenuPosition(trigger));
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function selectOption(next: string) {
    onChange(next);
    close();
  }

  const menu =
    open && position && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed overflow-hidden rounded-lg border border-oo-light-stone bg-oo-warm-white py-1 shadow-lg"
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              zIndex: MENU_Z_INDEX,
            }}
          >
            <ul
              className="overflow-y-auto overscroll-contain"
              style={{ maxHeight: position.maxHeight }}
            >
              {VENDOR_HOURS_TIME_OPTIONS.map((option) => {
                const selected = option === displayValue;
                return (
                  <li key={option} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={cn(
                        "flex w-full items-center px-3 py-2 text-left text-sm text-oo-charcoal hover:bg-oo-cream focus-visible:bg-oo-cream focus-visible:outline-none",
                        selected && "bg-brand/10 font-semibold text-oo-charcoal"
                      )}
                      onClick={() => selectOption(option)}
                    >
                      {formatVendorHoursTimeLabel(option)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={cn(
          "inline-flex min-h-9 min-w-[7.5rem] items-center justify-between gap-2 rounded-md border border-oo-light-stone bg-oo-warm-white px-2.5 py-1.5 text-sm text-oo-charcoal",
          "hover:border-oo-stone-gray focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
      >
        <span>{formatVendorHoursTimeLabel(displayValue)}</span>
        <span className="text-[10px] text-oo-stone-gray" aria-hidden>
          ▾
        </span>
      </button>
      {menu}
    </>
  );
}
