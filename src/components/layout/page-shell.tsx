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
        variant === "dark" && "border-zinc-800 bg-black text-white",
        variant === "muted" && "border-zinc-200 bg-zinc-100 text-zinc-950",
        variant === "light" && "border-zinc-200 bg-white text-zinc-950",
        className
      )}
    >
      {children}
    </div>
  );
}
