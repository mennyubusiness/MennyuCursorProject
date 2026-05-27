import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ShellWidth = "shell" | "tight" | "full";

export function PageShell({
  children,
  width = "shell",
  className,
}: {
  children: ReactNode;
  width?: ShellWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        width === "full" ? "w-full" : width === "tight" ? "oo-shell-tight" : "oo-shell",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageSection({
  children,
  className,
  id,
  "aria-labelledby": ariaLabelledby,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <section id={id} aria-labelledby={ariaLabelledby} className={cn("py-16 sm:py-20 lg:py-24", className)}>
      {children}
    </section>
  );
}

export function PageBand({
  children,
  variant = "light",
  className,
}: {
  children: ReactNode;
  variant?: "light" | "dark" | "muted";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full border-y",
        variant === "dark" && "border-oo-charcoal/20 bg-oo-charcoal text-oo-warm-white",
        variant === "muted" && "border-oo-light-stone bg-oo-cream text-oo-charcoal",
        variant === "light" && "border-oo-light-stone bg-oo-warm-white text-oo-charcoal",
        className
      )}
    >
      {children}
    </div>
  );
}
