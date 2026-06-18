type DestinationPodMarqueeProps = {
  items: string[];
};

function MarqueeItems({ items }: { items: string[] }) {
  return (
    <>
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className="flex shrink-0 items-center gap-3 text-[11px] font-bold uppercase tracking-[0.14em] text-oo-warm-white sm:text-xs"
        >
          <span className="text-brand" aria-hidden>
            •
          </span>
          {item}
        </li>
      ))}
    </>
  );
}

export function DestinationPodMarquee({ items }: DestinationPodMarqueeProps) {
  if (items.length === 0) return null;

  const loopItems = [...items, ...items];

  return (
    <div
      className="relative z-20 border-t border-white/10 bg-oo-charcoal py-3"
      aria-label="Pod highlights"
    >
      <p className="sr-only">{items.join(", ")}</p>

      {/* Animated seamless loop (desktop + mobile) */}
      <div className="overflow-hidden motion-reduce:hidden">
        <div className="flex w-max will-change-transform animate-destination-pod-marquee">
          <ul className="flex min-w-max shrink-0 items-center gap-8 whitespace-nowrap">
            <MarqueeItems items={loopItems} />
          </ul>
        </div>
      </div>

      {/* Reduced motion: static horizontal scroll, single row */}
      <div className="hidden overflow-x-auto motion-reduce:block">
        <ul className="flex min-w-max items-center gap-8 whitespace-nowrap px-4">
          <MarqueeItems items={items} />
        </ul>
      </div>
    </div>
  );
}
