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
          <span className="text-brand" aria-hidden>
            •
          </span>
          {item}
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
      aria-label="Pod highlights"
    >
      <div className="overflow-hidden motion-reduce:overflow-x-auto">
        <div className="flex w-max animate-destination-pod-marquee motion-reduce:w-full motion-reduce:animate-none motion-reduce:overflow-x-auto">
          <MarqueeRow items={items} />
          <MarqueeRow items={items} ariaHidden />
        </div>
      </div>
    </div>
  );
}
