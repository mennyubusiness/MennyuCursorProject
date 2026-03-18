/** Shared checkout step indicator (Review → Details → Payment). */
export function CheckoutProgress({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { step: 1 as const, label: "Review" },
    { step: 2 as const, label: "Details" },
    { step: 3 as const, label: "Payment" },
  ];
  return (
    <nav
      aria-label="Checkout progress"
      className="mb-8 flex flex-wrap items-center gap-2 text-sm text-stone-500"
    >
      {steps.map((s, i) => {
        const done = activeStep > s.step;
        const current = activeStep === s.step;
        return (
          <span key={s.step} className="flex items-center gap-2">
            {i > 0 && (
              <span className="text-stone-300" aria-hidden>
                →
              </span>
            )}
            <span
              className={
                current
                  ? "rounded-full bg-mennyu-primary/20 px-3 py-1 font-semibold text-stone-900"
                  : done
                    ? "text-stone-600"
                    : "text-stone-400"
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
