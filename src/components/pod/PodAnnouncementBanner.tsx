import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/cn";

type PodAnnouncementBannerProps = {
  text: string;
  /** Dashboard preview: skip outer page shell padding. */
  compact?: boolean;
  className?: string;
};

function AnnouncementIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 11v2a1 1 0 0 0 1 1h1l4 9V4L5 9H4a1 1 0 0 0-1 1Z" />
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7" />
      <path d="M18.5 6a7.5 7.5 0 0 1 0 12" />
    </svg>
  );
}

/** Plain-text pod owner announcement — no rich text or links. */
export function PodAnnouncementBanner({
  text,
  compact = false,
  className,
}: PodAnnouncementBannerProps) {
  const banner = (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-amber-50/80 to-oo-cream/70 px-4 py-3.5 shadow-sm ring-1 ring-amber-100/80",
        className
      )}
      role="note"
      aria-label="Pod update"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100/90 text-amber-900">
        <AnnouncementIcon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-900/75">
          Pod update
        </p>
        <p className="mt-1 break-words text-sm leading-relaxed text-oo-charcoal [overflow-wrap:anywhere]">
          {text}
        </p>
      </div>
    </div>
  );

  if (compact) {
    return banner;
  }

  return <PageShell className="py-3">{banner}</PageShell>;
}
