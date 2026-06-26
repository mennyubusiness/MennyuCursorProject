import Link from "next/link";

const actionButtonClass =
  "inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-2.5 text-sm font-semibold text-oo-charcoal transition hover:bg-oo-warm-white";

export function PodPublicPageActions({
  publicPageHref,
  settingsHref,
}: {
  publicPageHref: string;
  settingsHref: string;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-2">
      <Link href={publicPageHref} target="_blank" rel="noopener noreferrer" className={actionButtonClass}>
        View public page
      </Link>
      <Link href={settingsHref} className={actionButtonClass}>
        Edit pod profile
      </Link>
    </div>
  );
}
