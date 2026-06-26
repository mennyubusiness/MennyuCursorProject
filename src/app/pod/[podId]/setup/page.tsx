import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorSetupChecklist } from "@/components/vendor/VendorSetupChecklist";
import { loadPodDashboardContext } from "@/lib/pod-dashboard-data.server";
import { POD_ALL_READY_COPY } from "@/lib/pod-operational-copy";
import { POD_SETUP_REQUIRED_CHECKLIST_KEYS } from "@/lib/vendor-pod-readiness";

const REQUIRED_KEYS = new Set<string>(POD_SETUP_REQUIRED_CHECKLIST_KEYS);

export default async function PodSetupPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const ctx = await loadPodDashboardContext(podId);
  if (!ctx) notFound();

  const required = ctx.podSetupChecklist.filter((item) => REQUIRED_KEYS.has(item.key));

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Setup"
        description={
          ctx.setupComplete
            ? "Required readiness checklist for your pod."
            : "Complete these steps before customers can order from your pod."
        }
        actions={
          ctx.setupComplete ? (
            <Link
              href={`/pod/${podId}/dashboard`}
              className="inline-flex items-center justify-center rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
            >
              Back to dashboard
            </Link>
          ) : null
        }
      />

      <div className="mt-8 space-y-8">
        {ctx.setupComplete ? (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950">
            <p className="font-medium">{POD_ALL_READY_COPY}</p>
            <p className="mt-1">Use the dashboard for day-to-day operations. Return here if something changes.</p>
          </div>
        ) : null}

        <VendorSetupChecklist items={required} title="Required to accept orders" />
      </div>
    </DashboardShell>
  );
}
