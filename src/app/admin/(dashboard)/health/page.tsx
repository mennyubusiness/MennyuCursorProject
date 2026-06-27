import Link from "next/link";
import {
  DashboardCard,
  DashboardMetricGrid,
  DashboardPageHeader,
  DashboardSection,
  DashboardShell,
} from "@/components/dashboard";
import { getAdminHealthDashboard } from "@/services/admin-health-dashboard.service";
import type { AdminHealthMetric, AdminHealthMetricTone } from "@/services/admin-health-dashboard.service";

function toneClass(tone: AdminHealthMetricTone): string {
  switch (tone) {
    case "critical":
      return "border-red-200 bg-red-50/80";
    case "warning":
      return "border-amber-200 bg-amber-50/80";
    default:
      return "border-oo-light-stone bg-oo-warm-white";
  }
}

function formatCount(metric: AdminHealthMetric): string {
  if (metric.count == null) return "Not tracked";
  return String(metric.count);
}

function HealthMetricTile({ metric }: { metric: AdminHealthMetric }) {
  const inner = (
    <DashboardCard className={`h-full ${toneClass(metric.tone)}`}>
      <p className="text-2xl font-semibold text-oo-charcoal">{formatCount(metric)}</p>
      <p className="mt-1 font-medium text-oo-charcoal">{metric.label}</p>
      <p className="mt-1 text-xs text-oo-stone-gray">{metric.description}</p>
    </DashboardCard>
  );

  if (metric.href && metric.count !== null) {
    return (
      <Link href={metric.href} className="block min-w-0">
        {inner}
      </Link>
    );
  }
  return inner;
}

export default async function AdminHealthPage() {
  const dashboard = await getAdminHealthDashboard();

  return (
    <DashboardShell tier="admin" className="space-y-10">
      <DashboardPageHeader
        headingLevel={1}
        title="System health"
        description="Operational snapshot for launch support — what is broken right now and where to investigate."
      />

      <DashboardSection title="Critical now" showHeader>
        <DashboardMetricGrid columns="three">
          {dashboard.criticalNow.map((m) => (
            <HealthMetricTile key={m.id} metric={m} />
          ))}
        </DashboardMetricGrid>
      </DashboardSection>

      {dashboard.sections.map((section) => (
        <DashboardSection key={section.id} title={section.title} showHeader>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.metrics.map((m) => (
              <HealthMetricTile key={m.id} metric={m} />
            ))}
          </div>
        </DashboardSection>
      ))}

      <p className="text-xs text-oo-stone-gray">
        Generated {dashboard.generatedAt.toLocaleString()} · Metrics marked &quot;Not tracked&quot; are not persisted yet.
      </p>
    </DashboardShell>
  );
}
