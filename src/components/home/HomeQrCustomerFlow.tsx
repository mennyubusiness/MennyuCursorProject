import { HOME_QR_FLOW_STEPS } from "@/lib/home-marketing";
import { cn } from "@/lib/cn";

type HomeQrCustomerFlowProps = {
  className?: string;
  /** Dark hero background uses light text; light sections use dark text. */
  tone?: "dark" | "light";
};

export function HomeQrCustomerFlow({ className, tone = "dark" }: HomeQrCustomerFlowProps) {
  const isDark = tone === "dark";

  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 sm:px-5 sm:py-4",
        isDark
          ? "border-oo-light-stone/15 bg-oo-charcoal/60"
          : "border-oo-light-stone bg-oo-warm-white",
        className
      )}
      aria-label="Primary guest ordering flow"
    >
      <p
        className={cn(
          "text-[10px] font-bold uppercase tracking-[0.18em]",
          isDark ? "text-oo-cream/50" : "text-oo-stone-gray"
        )}
      >
        Primary guest path
      </p>
      <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-medium sm:text-base">
        {HOME_QR_FLOW_STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2">
            <span className={cn(isDark ? "text-oo-warm-white" : "text-oo-charcoal")}>{step}</span>
            {index < HOME_QR_FLOW_STEPS.length - 1 ? (
              <span className={cn("text-xs", isDark ? "text-oo-cream/40" : "text-oo-stone-gray")} aria-hidden>
                →
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
