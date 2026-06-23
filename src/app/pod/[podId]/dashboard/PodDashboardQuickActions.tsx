import Link from "next/link";
import { buildPodCustomerPath } from "@/lib/customer-public-url";

type PodDashboardQuickActionsProps = {
  podId: string;
  podSlug: string;
};

export function PodDashboardQuickActions({ podId, podSlug }: PodDashboardQuickActionsProps) {
  const publicPodPath = buildPodCustomerPath(podSlug);

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Quick actions</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-3">
        <li>
          <Link
            href={publicPodPath}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full flex-col rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
          >
            <span className="font-medium text-oo-charcoal">View public pod page</span>
            <span className="mt-1 text-sm text-oo-stone-gray">See what customers see at your pod</span>
            <span className="mt-2 truncate font-mono text-xs text-oo-stone-gray">{publicPodPath}</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/pod/${podId}/settings#ordering-qr`}
            className="flex h-full flex-col rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
          >
            <span className="font-medium text-oo-charcoal">QR &amp; signage</span>
            <span className="mt-1 text-sm text-oo-stone-gray">Download your pod QR and copy the order link</span>
          </Link>
        </li>
        <li>
          <Link
            href={`/pod/${podId}/settings`}
            className="flex h-full flex-col rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 transition-colors hover:border-oo-stone-gray/30 hover:bg-oo-cream"
          >
            <span className="font-medium text-oo-charcoal">Edit pod profile</span>
            <span className="mt-1 text-sm text-oo-stone-gray">Brand, pickup instructions, and amenities</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
