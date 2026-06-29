import Image from "next/image";
import type { ReactNode } from "react";
import { BRAND } from "@/lib/brand-assets";
import { cn } from "@/lib/cn";

const VERIFY_EMAIL_BENEFITS = [
  { title: "Browse pods", body: "Every vendor at your local food pod." },
  { title: "One cart", body: "Mix vendors, checkout once." },
  { title: "Pickup ready", body: "One payment, one pickup trip." },
] as const;

function VerifyEmailBrandPanel() {
  return (
    <div className="relative flex flex-col justify-center bg-oo-cream/80 px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(249, 115, 22, 0.08), transparent 55%)",
        }}
        aria-hidden
      />

      <div className="relative z-10">
        <Image
          src={BRAND.horizontalLogoLight}
          alt="Open Order Co."
          width={320}
          height={84}
          className="h-auto w-full max-w-[min(100%,16rem)] object-contain sm:max-w-[18rem]"
          priority
        />

        <div className="mt-6 border-t border-oo-light-stone/80 pt-6">
          <h2 className="text-xl font-black leading-tight tracking-tight text-oo-charcoal sm:text-2xl lg:text-[1.65rem]">
            One network.
            <span className="block text-oo-stone-gray">Every vendor. One cart.</span>
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-oo-stone-gray sm:text-base">
            Order from multiple food carts in one shared checkout.
          </p>
        </div>

        <ul className="mt-6 hidden gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3">
          {VERIFY_EMAIL_BENEFITS.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white/90 px-3 py-2.5 sm:px-3.5 sm:py-3"
            >
              <p className="text-sm font-semibold text-oo-charcoal">{item.title}</p>
              <p className="mt-0.5 text-xs leading-snug text-oo-stone-gray">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type VerifyEmailGateLayoutProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Centered two-column verification gate for account routes (not full-viewport AuthShell).
 * Breaks out of narrow account hub max-width so desktop feels balanced.
 */
export function VerifyEmailGateLayout({ children, className }: VerifyEmailGateLayoutProps) {
  return (
    <div
      className={cn(
        "relative left-1/2 w-[min(100vw-2rem,1040px)] max-w-none -translate-x-1/2",
        className
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-oo-light-stone bg-oo-warm-white shadow-[0_8px_40px_-16px_rgba(31,31,28,0.14)]">
        <div className="grid lg:grid-cols-[1fr_1fr] lg:items-stretch">
          <div className="order-2 border-t border-oo-light-stone lg:order-1 lg:border-r lg:border-t-0">
            <VerifyEmailBrandPanel />
          </div>
          <div className="order-1 flex flex-col justify-center px-6 py-8 sm:px-8 sm:py-10 lg:order-2 lg:px-10 lg:py-12">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
