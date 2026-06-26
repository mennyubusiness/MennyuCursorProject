import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorSetupChecklist } from "@/components/vendor/VendorSetupChecklist";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VENDOR_ALL_READY_COPY } from "@/lib/vendor-operational-copy";

const REQUIRED_KEYS = new Set(["profile", "stripe", "pos", "menu", "pod_invite"]);
const RECOMMENDED_KEYS = new Set(["kitchen"]);

export default async function VendorSetupPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) notFound();

  const required = ctx.readiness.checklist.filter((item) => REQUIRED_KEYS.has(item.key));
  const recommended = ctx.readiness.checklist.filter(
    (item) => RECOMMENDED_KEYS.has(item.key) || (!REQUIRED_KEYS.has(item.key) && !item.complete)
  );

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Setup"
        description="Everything required before customers can order smoothly."
        actions={
          ctx.setupComplete ? (
            <Link
              href={`/vendor/${vendorId}/dashboard`}
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
            <p className="font-medium">{VENDOR_ALL_READY_COPY}</p>
            <p className="mt-1">Use the dashboard for day-to-day operations. Return here if something changes.</p>
          </div>
        ) : null}

        <VendorSetupChecklist items={required} title="Required to accept orders" />
        {recommended.length > 0 ? (
          <VendorSetupChecklist items={recommended} title="Recommended" />
        ) : null}
      </div>
    </DashboardShell>
  );
}
