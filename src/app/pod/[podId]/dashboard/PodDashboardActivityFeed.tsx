import Link from "next/link";
import { buildPodCustomerPath } from "@/lib/customer-public-url";
import type { PodActivityFeed } from "@/services/pod-activity.service";
import { formatPodActivityTimestamp } from "@/services/pod-activity.service";

type PodDashboardActivityFeedProps = {
  podId: string;
  podSlug: string;
  feed: PodActivityFeed;
};

function ActivityList({ items, showTimestamps }: { items: PodActivityFeed["recent"]; showTimestamps: boolean }) {
  if (items.length === 0) return null;

  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2.5 text-sm text-oo-charcoal"
        >
          <p>{item.message}</p>
          {showTimestamps && item.occurredAt ? (
            <p className="mt-1 text-xs text-oo-stone-gray">{formatPodActivityTimestamp(item.occurredAt)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PodDashboardActivityFeed({ podId, podSlug, feed }: PodDashboardActivityFeedProps) {
  const publicPodPath = buildPodCustomerPath(podSlug);

  if (feed.isEmpty) {
    return (
      <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Recent activity</h2>
        <p className="mt-3 rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-3 text-sm text-oo-charcoal">
          No recent pod activity yet. Share your QR code and make sure vendors are orderable to start
          capturing orders.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link
            href={`/pod/${podId}/settings#ordering-qr`}
            className="font-medium text-oo-charcoal underline hover:text-oo-charcoal"
          >
            QR &amp; signage
          </Link>
          <Link
            href={publicPodPath}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-oo-charcoal underline hover:text-oo-charcoal"
          >
            View public pod page
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-oo-light-stone bg-oo-cream/50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">Recent activity</h2>
      <p className="mt-1 text-sm text-oo-stone-gray">
        What&apos;s been happening at your pod — order and vendor updates only.
      </p>

      {feed.recent.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Latest</h3>
          <ActivityList items={feed.recent} showTimestamps />
        </div>
      ) : null}

      {feed.currentStatus.length > 0 ? (
        <div className={feed.recent.length > 0 ? "mt-5" : "mt-4"}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">Current status</h3>
          <ActivityList items={feed.currentStatus} showTimestamps={false} />
        </div>
      ) : null}
    </section>
  );
}
