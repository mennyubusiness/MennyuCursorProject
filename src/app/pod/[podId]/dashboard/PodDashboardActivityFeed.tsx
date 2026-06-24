import type { PodActivityFeed } from "@/services/pod-activity.service";
import { formatPodActivityTimestamp } from "@/services/pod-activity.service";
import { DashboardCard, DashboardEmptyState } from "@/components/dashboard";

type PodDashboardActivityFeedProps = {
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
          <p className="break-words [overflow-wrap:anywhere]">{item.message}</p>
          {showTimestamps && item.occurredAt ? (
            <p className="mt-1 text-xs text-oo-stone-gray">{formatPodActivityTimestamp(item.occurredAt)}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PodDashboardActivityFeed({ feed }: PodDashboardActivityFeedProps) {
  if (feed.isEmpty) {
    return (
      <DashboardCard variant="muted" title="Recent activity" className="p-4">
        <DashboardEmptyState
          title="No recent pod activity yet."
          description="Share your pod QR code and make sure vendors are orderable to start capturing orders."
          className="mt-3"
        />
      </DashboardCard>
    );
  }

  return (
    <DashboardCard
      variant="muted"
      title="Recent activity"
      description="What's been happening at your pod — order and vendor updates only."
      className="p-4"
    >
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
    </DashboardCard>
  );
}
