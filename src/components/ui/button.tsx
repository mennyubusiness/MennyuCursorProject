import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "ghost-light" | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-tight transition-all duration-200 ease-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none active:scale-[0.98] motion-reduce:active:scale-100";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white shadow-sm hover:bg-brand-hover focus-visible:outline-brand",
  secondary:
    "border-2 border-oo-charcoal bg-transparent text-oo-charcoal hover:bg-oo-charcoal hover:text-oo-warm-white focus-visible:outline-oo-charcoal",
  outline:
    "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:border-oo-stone-gray hover:bg-oo-cream focus-visible:outline-oo-charcoal",
  ghost:
    "text-oo-stone-gray hover:bg-oo-light-stone/50 hover:text-oo-charcoal focus-visible:outline-oo-charcoal",
  "ghost-light":
    "text-oo-cream/80 hover:bg-oo-warm-white/10 hover:text-oo-warm-white focus-visible:outline-oo-warm-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 py-2 text-sm",
  md: "min-h-11 px-5 py-2.5 text-sm sm:text-base",
  lg: "min-h-12 px-7 py-3 text-base sm:min-h-[3.25rem] sm:text-lg",
  touch: "min-h-[3.25rem] px-6 py-3 text-base",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button type={type} className={buttonClassName({ variant, size, className })} {...props} />
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className={buttonClassName({ variant, size, className })} {...props} />
  );
}
