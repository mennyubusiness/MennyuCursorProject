import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type CheckoutSectionCardProps = {
  id?: string;
  title: string;
  helper?: string;
  children: ReactNode;
  className?: string;
  status?: "default" | "error" | "complete";
};

export function CheckoutSectionCard({
  id,
  title,
  helper,
  children,
  className,
  status = "default",
}: CheckoutSectionCardProps) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm sm:p-5",
        status === "error" && "border-amber-300 bg-amber-50/40",
        status === "complete" && "border-emerald-200 bg-emerald-50/30",
        className
      )}
    >
      <h2 className="text-base font-bold text-oo-charcoal">{title}</h2>
      {helper ? (
        <p className="mt-1 text-sm leading-snug text-oo-stone-gray">{helper}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
