type DestinationPodMarqueeProps = {
  items: string[];
};

function MarqueeRow({ items, ariaHidden = false }: { items: string[]; ariaHidden?: boolean }) {
  return (
    <ul
      className="flex min-w-max shrink-0 items-center gap-8 whitespace-nowrap px-6"
      aria-hidden={ariaHidden || undefined}
    >
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex shrink-0 items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-oo-warm-white sm:text-xs"
        >
          <span className="shrink-0 text-brand" aria-hidden>
            •
          </span>
          <span className="shrink-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function DestinationPodMarquee({ items }: DestinationPodMarqueeProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="relative z-20 border-t border-white/10 bg-oo-charcoal py-3"
      aria-label="Pod vendors"
    >
      <p className="sr-only">{items.join(", ")}</p>

      {/* Animated seamless loop: two identical rows, track animates -50% */}
      <div className="overflow-hidden motion-reduce:hidden">
        <div className="flex w-max shrink-0 will-change-transform animate-destination-pod-marquee">
          <MarqueeRow items={items} />
          <MarqueeRow items={items} ariaHidden />
        </div>
      </div>

      {/* Reduced motion: static horizontal scroll, single row */}
      <div className="hidden overflow-x-auto motion-reduce:block">
        <MarqueeRow items={items} />
      </div>
    </div>
  );
}
