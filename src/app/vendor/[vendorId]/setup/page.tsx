import Link from "next/link";
import { notFound } from "next/navigation";

import { DashboardPageHeader, DashboardShell } from "@/components/dashboard";
import { VendorSetupChecklist } from "@/components/vendor/VendorSetupChecklist";
import { loadVendorDashboardContext } from "@/lib/vendor-dashboard-data.server";
import { VENDOR_ALL_READY_COPY } from "@/lib/vendor-operational-copy";
import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";

const REQUIRED_KEYS = new Set(["profile", "stripe", "pos", "menu", "pod_invite"]);

function buildRecommendedItems(input: {
  vendorId: string;
  hasLogo: boolean;
  currentPod: { id: string; name: string } | null;
}): ReadinessChecklistItem[] {
  const items: ReadinessChecklistItem[] = [
    {
      key: "logo",
      label: "Logo uploaded",
      complete: input.hasLogo,
      owner: "vendor",
      description: "Customers see your logo on the pod menu.",
      actionHref: `/vendor/${input.vendorId}/settings?section=profile`,
      actionLabel: "Edit business profile",
    },
    {
      key: "kitchen",
      label: "Try Kitchen mode for busy shifts",
      complete: true,
      owner: "vendor",
      description: "A simplified full-screen order board for the line.",
      actionHref: `/vendor/${input.vendorId}/kitchen`,
      actionLabel: "Open Kitchen mode",
    },
  ];

  if (input.currentPod) {
    items.splice(1, 0, {
      key: "pickup",
      label: "Pickup instructions on pod page",
      complete: false,
      owner: "pod_owner",
      description: `Ask your pod (${input.currentPod.name}) to add pickup directions customers see at checkout.`,
      actionHref: `/pod/${input.currentPod.id}/settings`,
      actionLabel: "View pod settings",
    });
  }

  return items;
}

export default async function VendorSetupPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const ctx = await loadVendorDashboardContext(vendorId);
  if (!ctx) notFound();

  const required = ctx.readiness.checklist.filter((item) => REQUIRED_KEYS.has(item.key));
  const recommended = buildRecommendedItems({
    vendorId,
    hasLogo: Boolean(ctx.vendorRecord.imageUrl?.trim()),
    currentPod: ctx.currentPod,
  }).filter((item) => !item.complete || item.key === "kitchen");

  return (
    <DashboardShell tier="command" className="px-0 pb-0 pt-0">
      <DashboardPageHeader
        headingLevel={1}
        title="Setup"
        description={
          ctx.setupComplete
            ? "Readiness checklist — everything required before customers can order."
            : "Complete these steps before accepting orders."
        }
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
        <VendorSetupChecklist
          items={recommended}
          title="Recommended"
          emptyCompleteCopy="Everything is ready for orders."
        />
      </div>
    </DashboardShell>
  );
}
