import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPodContextNav } from "@/components/admin/AdminEntityContextNav";
import { prisma } from "@/lib/db";
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
import { AdminPodPayoutSection } from "./AdminPodPayoutSection";
import { AdminPodRescueClient } from "./AdminPodRescueClient";

export default async function AdminPodDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ podId: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { podId } = await params;
  const { section } = await searchParams;
  const id = podId?.trim();
  if (!id) notFound();

  const [detail, vendorOptions, payoutSettings, allocationSummary, recipientOptions, allocations, recipientConnect, transferSummary, transfers] =
    await Promise.all([
      loadAdminPodDetail(id),
      prisma.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
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
    expandedByDefault: section === "payouts",
  });

  return (
    <div className="space-y-8">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{detail.pod.name}</span>
      </nav>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-oo-charcoal">{detail.pod.name}</h1>
        <p className="mt-1 font-mono text-sm text-oo-stone-gray">{detail.pod.slug}</p>
      </header>

      <AdminPodContextNav
        podId={id}
        podName={detail.pod.name}
        podSlug={detail.pod.slug}
        publicPath={detail.pod.publicPath}
        owners={detail.owners}
        vendors={detail.vendors}
        recentOrders={detail.recentOrders}
      />

      <AdminPodRescueClient detail={detail} vendorOptions={vendorOptions} />

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
