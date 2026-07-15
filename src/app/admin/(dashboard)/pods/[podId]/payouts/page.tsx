import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAdminPodDetail } from "@/services/admin-pod-detail.service";
import {
  deriveAdminPodDetailLayout,
} from "@/lib/admin-pod-detail-layout";
import { listRecentPodPayoutAllocationsForAdmin } from "@/services/pod-payout-allocation.service";
import { getPodPayoutRecipientConnectStatusForPod } from "@/services/pod-payout-connect.service";
import {
  getPodPayoutAllocationSummary,
  getPodPayoutRecipientOptions,
  getPodPayoutSettingsForAdmin,
} from "@/services/pod-payout-settings.service";
import {
  getPodPayoutTransferAdminSummary,
  listRecentPodPayoutTransfersForAdmin,
} from "@/services/pod-payout-transfer.service";
import { AdminPodPayoutSection } from "../AdminPodPayoutSection";

export const dynamic = "force-dynamic";

export default async function AdminPodPayoutsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const id = podId?.trim();
  if (!id) notFound();

  const [detail, payoutSettings, allocationSummary, recipientOptions, allocations, recipientConnect, transferSummary, transfers] =
    await Promise.all([
      loadAdminPodDetail(id),
      getPodPayoutSettingsForAdmin(id),
      getPodPayoutAllocationSummary(id),
      getPodPayoutRecipientOptions(id),
      listRecentPodPayoutAllocationsForAdmin(id),
      getPodPayoutRecipientConnectStatusForPod(id),
      getPodPayoutTransferAdminSummary(id),
      listRecentPodPayoutTransfersForAdmin(id),
    ]);
  if (!detail) notFound();

  const failedTransferCount = transfers.filter((row) => row.status === "failed").length;
  const payoutLayout = deriveAdminPodDetailLayout({
    podPayoutsEnabled: payoutSettings?.podPayoutsEnabled ?? false,
    podPayoutRecipientUserId: payoutSettings?.podPayoutRecipientUserId ?? null,
    recipientConnectStatus: recipientConnect,
    allocationSummary,
    transferSummary,
    allocationCount: allocations.length,
    transferCount: transfers.length,
    failedTransferCount,
    expandedByDefault: true,
  });

  return (
    <div className="space-y-6">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <Link href={`/admin/pods/${id}`} className="hover:text-oo-charcoal hover:underline">
          {detail.pod.name}
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">Payouts</span>
      </nav>

      <header className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4">
        <h1 className="text-xl font-semibold text-oo-charcoal">Pod payouts</h1>
        <p className="mt-1 text-sm text-oo-stone-gray">
          Manage pod revenue share, recipient setup, allocations, and transfers for {detail.pod.name}.
        </p>
        <Link href={`/admin/pods/${id}`} className="mt-2 inline-block text-sm font-semibold underline">
          Back to pod overview
        </Link>
      </header>

      <AdminPodPayoutSection
        podId={id}
        layout={payoutLayout}
        settings={payoutSettings}
        recipientOptions={recipientOptions}
        allocationSummary={allocationSummary}
        recipientConnectStatus={recipientConnect}
        transferSummary={transferSummary}
        transfers={transfers}
        allocations={allocations}
      />
    </div>
  );
}
