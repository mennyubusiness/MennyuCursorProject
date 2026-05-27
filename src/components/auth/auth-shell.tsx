import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND, BRAND_ALT } from "@/lib/brand-assets";
import { OpenOrderLogo } from "@/components/brand/OpenOrderLogo";
import { cn } from "@/lib/cn";

type AuthShellProps = {
  children: ReactNode;
  /** Panel heading inside the form column */
  title?: string;
  subtitle?: string;
  className?: string;
};

export function AuthShell({ children, title, subtitle, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        "flex w-full min-h-[calc(100dvh-4.25rem)] flex-col lg:min-h-[calc(100dvh-5rem)] lg:flex-row",
        className
      )}
    >
      <div className="relative hidden overflow-hidden border-r border-oo-light-stone/15 bg-oo-charcoal lg:flex lg:w-[min(44%,32rem)] lg:flex-col lg:justify-between xl:w-[42%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(249,115,22,0.18) 0%, transparent 45%), radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,253,248,0.06), transparent)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-1 flex-col p-10 xl:p-14">
          <OpenOrderLogo variant="header" className="self-start" />
          <div className="my-auto flex flex-col items-center py-8">
            <Image
              src={BRAND.seal}
              alt={BRAND_ALT.seal}
              width={280}
              height={280}
              className="h-auto w-full max-w-[16rem] drop-shadow-2xl"
              priority
            />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-oo-cream/50">
              Commerce operating system
            </p>
            <h2 className="mt-4 max-w-md text-3xl font-black leading-[1.05] tracking-tight text-oo-warm-white xl:text-4xl">
              One network.
              <span className="block text-oo-cream/55">Every vendor. One cart.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-oo-cream/55">
              Sign in to manage pods, run your kitchen, or pick up where you left off ordering.
            </p>
          </div>
        </div>
        <div className="relative border-t border-oo-light-stone/15 px-10 py-6 text-xs text-oo-stone-gray xl:px-14">
          Multi-vendor pickup · Unified checkout
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-oo-cream px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <OpenOrderLogo variant="header" />
          </div>
          {(title || subtitle) && (
            <div className="mb-8">
              {title && (
                <h1 className="text-3xl font-black tracking-tight text-oo-charcoal">{title}</h1>
              )}
              {subtitle && <p className="mt-2 text-base text-oo-stone-gray">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}

export function AuthFormCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "oo-card space-y-6 border-oo-light-stone p-6 shadow-md sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
