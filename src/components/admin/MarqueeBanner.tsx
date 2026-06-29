type MarqueeBannerTone = "admin" | "brand";

type MarqueeBannerProps = {
  /** Visible repeating segments (joined with separator in each item). */
  items: string[];
  tone?: MarqueeBannerTone;
  /** Accessible label for screen readers (repeated visual text is aria-hidden). */
  ariaLabel: string;
  className?: string;
};

const TONE_CLASS: Record<MarqueeBannerTone, string> = {
  admin:
    "border-b border-amber-700/30 bg-amber-400 py-2.5 text-oo-charcoal sm:py-3",
  brand: "border-t border-white/10 bg-oo-charcoal py-3 text-oo-warm-white",
};

const ITEM_CLASS: Record<MarqueeBannerTone, string> = {
  admin:
    "text-xs font-bold uppercase tracking-[0.2em] text-oo-charcoal sm:text-sm",
  brand:
    "text-[11px] font-bold uppercase tracking-[0.14em] text-oo-warm-white sm:text-xs",
};

const SEPARATOR_CLASS: Record<MarqueeBannerTone, string> = {
  admin: "shrink-0 text-oo-charcoal/70",
  brand: "shrink-0 text-brand",
};

function MarqueeRow({
  items,
  tone,
  ariaHidden = false,
}: {
  items: string[];
  tone: MarqueeBannerTone;
  ariaHidden?: boolean;
}) {
  return (
    <ul
      className="flex min-w-max shrink-0 items-center gap-8 whitespace-nowrap px-6"
      aria-hidden={ariaHidden || undefined}
    >
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className={`flex shrink-0 items-center gap-3 ${ITEM_CLASS[tone]}`}>
          <span className={SEPARATOR_CLASS[tone]} aria-hidden>
            ·
          </span>
          <span className="shrink-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Horizontally scrolling marquee banner with reduced-motion fallback.
 */
export function MarqueeBanner({
  items,
  tone = "brand",
  ariaLabel,
  className = "",
}: MarqueeBannerProps) {
  if (items.length === 0) return null;

  return (
    <div
      className={`relative z-30 w-full overflow-x-hidden ${TONE_CLASS[tone]} ${className}`.trim()}
      aria-label={ariaLabel}
    >
      <p className="sr-only">{ariaLabel}</p>

      <div className="w-full overflow-hidden motion-reduce:hidden">
        <div className="flex w-max shrink-0 will-change-transform animate-destination-pod-marquee sm:animate-destination-pod-marquee-desktop">
          <MarqueeRow items={items} tone={tone} />
          <MarqueeRow items={items} tone={tone} ariaHidden />
        </div>
      </div>

      <div className="hidden w-full overflow-x-auto motion-reduce:block">
        <MarqueeRow items={items} tone={tone} />
      </div>
    </div>
  );
}
