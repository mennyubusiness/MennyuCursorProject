import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { loadAdminPodDetail } from "@/services/admin-pod-detail.service";
import { loadVendorReadinessBundles } from "@/lib/vendor-readiness-validation.server";
import { buildAdminPodSummary } from "@/lib/admin-pod-summary";
import { deriveAdminPodDetailLayout } from "@/lib/admin-pod-detail-layout";
import { getPodPayoutRecipientConnectStatusForPod } from "@/services/pod-payout-connect.service";
import {
  getPodPayoutAllocationSummary,
  getPodPayoutSettingsForAdmin,
} from "@/services/pod-payout-settings.service";
import { getPodPayoutTransferAdminSummary } from "@/services/pod-payout-transfer.service";
import { AdminPodOverview } from "./AdminPodOverview";

export const dynamic = "force-dynamic";

export default async function AdminPodDetailPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;
  const id = podId?.trim();
  if (!id) notFound();

  const [detail, vendorOptions, payoutSettings, allocationSummary, recipientConnect, transferSummary, failedTransferCount] =
    await Promise.all([
      loadAdminPodDetail(id),
      prisma.vendor.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
      getPodPayoutSettingsForAdmin(id),
      getPodPayoutAllocationSummary(id),
      getPodPayoutRecipientConnectStatusForPod(id),
      getPodPayoutTransferAdminSummary(id),
      prisma.podPayoutTransfer.count({ where: { podId: id, status: "failed" } }),
    ]);
  if (!detail) notFound();

  const vendorIds = detail.vendors.map((v) => v.vendorId);
  const readinessByVendorId = await loadVendorReadinessBundles(vendorIds, {
    includeDeliverectMappingIntegrity: true,
  });

  const payoutLayout = deriveAdminPodDetailLayout({
    podPayoutsEnabled: payoutSettings?.podPayoutsEnabled ?? false,
    podPayoutRecipientUserId: payoutSettings?.podPayoutRecipientUserId ?? null,
    recipientConnectStatus: recipientConnect,
    allocationSummary,
    transferSummary,
    allocationCount: allocationSummary.total.count,
    transferCount: transferSummary.paidTransferCount + transferSummary.blockedTransferCount,
    failedTransferCount,
  });

  const summary = buildAdminPodSummary({
    detail,
    readinessByVendorId,
    hasPayoutIssues: payoutLayout.hasPayoutIssues,
  });

  return (
    <div className="space-y-6">
      <nav className="text-sm text-oo-stone-gray">
        <Link href="/admin/pods" className="hover:text-oo-charcoal hover:underline">
          Pods
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-oo-charcoal">{detail.pod.name}</span>
      </nav>

      <AdminPodOverview summary={summary} detail={detail} vendorOptions={vendorOptions} />
    </div>
  );
}
