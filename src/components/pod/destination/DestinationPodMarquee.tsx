type DestinationPodMarqueeProps = {
  items: string[];
};

export function DestinationPodMarquee({ items }: DestinationPodMarqueeProps) {
  if (items.length === 0) return null;

  return (
    <div
      className="relative z-20 border-t border-white/15 bg-oo-charcoal/95 py-3"
      aria-label="Pod highlights"
    >
      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 sm:gap-x-6">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-oo-warm-white/90 sm:text-xs"
          >
            <span className="text-brand" aria-hidden>
              •
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
