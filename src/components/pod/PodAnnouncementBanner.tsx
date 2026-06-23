import { PageShell } from "@/components/layout/page-shell";

type PodAnnouncementBannerProps = {
  text: string;
  /** Dashboard preview: skip outer page shell padding. */
  compact?: boolean;
};

/** Plain-text pod owner announcement — no rich text or links. */
export function PodAnnouncementBanner({ text, compact = false }: PodAnnouncementBannerProps) {
  const banner = (
    <div
      className="rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-sm text-oo-charcoal"
      role="note"
      aria-label="Pod update"
    >
      <p className="font-medium text-oo-charcoal">Pod update</p>
      <p className="mt-1 break-words leading-relaxed [overflow-wrap:anywhere]">{text}</p>
    </div>
  );

  if (compact) {
    return <div className="p-2">{banner}</div>;
  }

  return <PageShell className="py-3">{banner}</PageShell>;
}
