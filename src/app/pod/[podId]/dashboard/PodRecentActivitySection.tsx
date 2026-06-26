import { PodDashboardActivityFeed } from "./PodDashboardActivityFeed";
import type { PodActivityFeed } from "@/services/pod-activity.service";

export function PodRecentActivitySection({ feed }: { feed: PodActivityFeed }) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-oo-charcoal">Recent activity</h2>
        <p className="mt-1 text-sm text-oo-stone-gray">High-level pod updates — no individual order details.</p>
      </div>
      <PodDashboardActivityFeed feed={feed} />
    </section>
  );
}
