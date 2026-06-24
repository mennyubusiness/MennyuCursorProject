import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

const AUTH_FEATURES = [
  { title: "Browse pods", body: "Every vendor at your local food pod." },
  { title: "One cart", body: "Mix vendors, checkout once." },
  { title: "Pickup ready", body: "One payment, one pickup trip." },
] as const;

function AuthBrandPanel() {
  return (
    <div className="relative flex flex-col justify-center overflow-hidden border-b border-oo-light-stone bg-oo-cream px-6 py-10 sm:px-10 sm:py-12 lg:w-1/2 lg:border-b-0 lg:border-r lg:border-oo-light-stone lg:px-10 lg:py-14 xl:px-12">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 65% 50% at 15% 20%, rgba(249, 115, 22, 0.1), transparent 55%)",
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-[38%] top-1/2 hidden w-[min(180%,70rem)] -translate-y-1/2 opacity-[0.11] lg:block xl:-right-[32%] xl:w-[75rem] xl:opacity-[0.13]"
        aria-hidden
      >
        <Image
          src={BRAND.seal}
          alt=""
          width={1024}
          height={1024}
          className="h-auto w-full object-contain"
          sizes="1200px"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-lg lg:mx-0 lg:max-w-xl xl:max-w-2xl">
        <div className="relative overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-[0_8px_32px_-12px_rgba(31,31,28,0.12)] sm:p-8">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-brand" aria-hidden />

          <div className="text-center lg:text-left">
            <Image
              src={BRAND.horizontalLogoLight}
              alt="Open Order Co. — Order more. Serve more."
              width={360}
              height={96}
              className="mx-auto h-auto w-full max-w-[min(100%,20rem)] object-contain lg:mx-0"
              priority
            />
          </div>

          <div className="mt-8 border-t border-oo-light-stone/80 pt-8 text-center lg:text-left">
            <h2 className="max-w-md text-2xl font-black leading-[1.08] tracking-tight text-oo-charcoal sm:text-3xl xl:text-4xl">
              One network.
              <span className="block text-oo-stone-gray">Every vendor. One cart.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-oo-stone-gray sm:text-base lg:mx-0">
              Order from multiple food carts in one shared checkout.
            </p>
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {AUTH_FEATURES.map((item) => (
              <li
                key={item.title}
                className="rounded-lg border border-oo-light-stone bg-oo-cream/80 px-3.5 py-3 text-center lg:text-left"
              >
                <p className="text-sm font-semibold text-oo-charcoal">{item.title}</p>
                <p className="mt-1 text-xs leading-snug text-oo-stone-gray">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

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
      <AuthBrandPanel />

      <div className="flex flex-1 flex-col justify-center border-oo-light-stone bg-oo-cream px-4 py-10 sm:px-8 sm:py-12 lg:w-1/2 lg:border-l lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-md">
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
        "space-y-6 rounded-xl border border-oo-light-stone bg-oo-warm-white p-6 shadow-[0_6px_28px_-10px_rgba(31,31,28,0.14)] sm:p-8",
        className
      )}
    >
      {children}
    </div>
  );
}
