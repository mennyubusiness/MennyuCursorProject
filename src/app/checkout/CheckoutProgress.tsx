import { cn } from "@/lib/cn";

/** Shared checkout step indicator (Review → Details → Payment). */
export function CheckoutProgress({
  activeStep,
  className,
}: {
  activeStep: 1 | 2 | 3;
  className?: string;
}) {
  const steps = [
    { step: 1 as const, label: "Review" },
    { step: 2 as const, label: "Details" },
    { step: 3 as const, label: "Payment" },
  ];
  return (
    <nav
      aria-label="Checkout progress"
      className={cn(
        "mb-8 flex flex-wrap items-center gap-2 text-sm text-oo-stone-gray",
        className
      )}
    >
      {steps.map((s, i) => {
        const done = activeStep > s.step;
        const current = activeStep === s.step;
        return (
          <span key={s.step} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-oo-light-stone" aria-hidden>
                →
              </span>
            )}
            <span
              className={
                current
                  ? "rounded-full bg-brand-muted px-3 py-1 font-semibold text-oo-charcoal"
                  : done
                    ? "text-oo-stone-gray"
                    : "text-oo-stone-gray/60"
              }
            >
              {done ? "✓ " : ""}
              {s.label}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
