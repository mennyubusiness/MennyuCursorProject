import Link from "next/link";
import type { ReactNode } from "react";
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
      <div className="relative hidden overflow-hidden border-r border-zinc-800 bg-black lg:flex lg:w-[min(44%,32rem)] lg:flex-col lg:justify-between xl:w-[42%]">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(160deg, rgba(212,16,16,0.2) 0%, transparent 45%), radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,0.06), transparent)",
          }}
          aria-hidden
        />
        <div className="relative flex flex-1 flex-col justify-end p-10 xl:p-14">
          <Link href="/" className="mb-auto inline-flex items-center gap-2.5 self-start">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-md bg-brand text-sm font-black text-white"
              aria-hidden
            >
              O
            </span>
            <span className="text-lg font-bold tracking-tight text-white">Open Order</span>
          </Link>
          <p className="mt-16 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
            Commerce operating system
          </p>
          <h2 className="mt-4 max-w-md text-4xl font-black leading-[1.05] tracking-tight text-white xl:text-5xl">
            One network.
            <span className="block text-zinc-500">Every vendor. One cart.</span>
          </h2>
          <p className="mt-6 max-w-sm text-base leading-relaxed text-zinc-500">
            Sign in to manage pods, run your kitchen, or pick up where you left off ordering.
          </p>
        </div>
        <div className="relative border-t border-zinc-800 px-10 py-6 text-xs text-zinc-600 xl:px-14">
          Multi-vendor pickup · Unified checkout
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center bg-zinc-50 px-4 py-12 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-md bg-brand text-sm font-black text-white"
                aria-hidden
              >
                O
              </span>
              <span className="text-lg font-bold text-black">Open Order</span>
            </Link>
          </div>
          {(title || subtitle) && (
            <div className="mb-8">
              {title && <h1 className="text-3xl font-black tracking-tight text-black">{title}</h1>}
              {subtitle && <p className="mt-2 text-base text-zinc-600">{subtitle}</p>}
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
        "oo-card space-y-6 border-zinc-200 p-6 shadow-md sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
