import { notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  fetchAdminOrderDetail,
  type AdminOrderDetail,
} from "@/lib/admin-order-detail-query";
import {
  AdminPaymentSummarySchemaError,
  fetchAdminOrderPaymentSummary,
} from "@/services/admin-order-payment-summary.service";
import { AdminOrderDetailClientLayout } from "./AdminOrderIssuesRefundsBridge";
import { getExceptionType, getExceptionReason } from "@/lib/admin-exceptions";
import { getAdminActionState } from "@/lib/admin-actions";
import { isManuallyRecovered } from "@/lib/admin-manual-recovery";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { buildAdminOrderTimeline } from "@/lib/admin-order-timeline";
import { canShowAdminTestToolsUi } from "@/lib/admin-test-tools";
import { ADMIN_SECTION_CARD } from "@/lib/admin-order-detail-ui";
import { AdminOrderDetailHeader, AdminOrderSummaryCard } from "./AdminOrderSummarySections";
import { AdminVendorOrderCard } from "./AdminVendorOrderCard";
import { AdminOrderQaToolsSection } from "./AdminOrderQaToolsSection";
import { AdminOrderTimelineSection } from "./AdminOrderTimelineSection";
import { AdminOrderTechnicalDetailsSection } from "./AdminOrderTechnicalDetailsSection";
import type { VendorRecoveryContext } from "./AdminOrderIssuesPanel";

function isDeliverectRecheckEligible(vo: AdminOrderDetail["vendorOrders"][number]): boolean {
  const ch = vo.deliverectChannelLinkId ?? vo.vendor.deliverectChannelLinkId;
  if (ch == null || String(ch).trim() === "") return false;
  if (vo.routingStatus !== "sent") return false;
  if (vo.fulfillmentStatus !== "pending") return false;
  if (vo.lastExternalStatusAt != null) return false;
  if (vo.manuallyRecoveredAt != null) return false;
  return true;
}

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const loaded = await fetchAdminOrderDetail(orderId);
  if (!loaded) notFound();
  const adminOrder: AdminOrderDetail = loaded;

  const session = await auth();
  const canExecuteRefunds = Boolean(session?.user?.isPlatformAdmin);

  let paymentSummary: Awaited<ReturnType<typeof fetchAdminOrderPaymentSummary>> = null;
  let paymentSummaryError: string | null = null;
  try {
    paymentSummary = await fetchAdminOrderPaymentSummary(orderId);
  } catch (e) {
    if (e instanceof AdminPaymentSummarySchemaError) {
      paymentSummaryError = e.message;
    } else {
      throw e;
    }
  }

  const routingAvailable = isRoutingRetryAvailable();
  const showAdminTestTools = await canShowAdminTestToolsUi();
  const timeline = buildAdminOrderTimeline(adminOrder);

  const vendorContexts = adminOrder.vendorOrders.map((vo) => {
    const exceptionType = getExceptionType(vo);
    const actionState = getAdminActionState(vo, routingAvailable);
    const reason = exceptionType ? getExceptionReason(vo, exceptionType) : null;
    const showRecoveredBadge = isManuallyRecovered(vo, vo.statusHistory);
    const progressionTargetsFiltered =
      actionState.showCancel && actionState.allowedProgressionTargets.includes("cancelled")
        ? actionState.allowedProgressionTargets.filter((t) => t !== "cancelled")
        : actionState.allowedProgressionTargets;
    const showProgressionUi =
      actionState.hasAnyProgressionAction && progressionTargetsFiltered.length > 0;

    return {
      vo,
      exceptionType,
      actionState,
      reason,
      showRecoveredBadge,
      progressionTargetsFiltered,
      showProgressionUi,
      showRecheck: isDeliverectRecheckEligible(vo),
    };
  });

  const vendorRecoveryContexts: VendorRecoveryContext[] = vendorContexts
    .filter((c) => c.actionState.hasAnyExceptionAction && c.exceptionType)
    .map(({ vo, exceptionType, actionState, reason }) => ({
      vendorOrderId: vo.id,
      vendorId: vo.vendorId,
      vendorName: vo.vendor.name,
      exceptionType: exceptionType!,
      reason,
      fulfillmentStatus: vo.fulfillmentStatus,
      hasExceptionAction: actionState.hasAnyExceptionAction,
      canCancel: actionState.showCancel,
    }));

  return (
    <div className="space-y-6 pb-8">
      <AdminOrderDetailHeader
        orderId={adminOrder.id}
        createdAt={adminOrder.createdAt}
        status={adminOrder.status}
        vendorOrders={adminOrder.vendorOrders}
        totalCents={adminOrder.totalCents}
        paymentRefundStatus={paymentSummary?.order.paymentRefundStatus}
      />

      <AdminOrderSummaryCard
        adminOrder={adminOrder}
        paymentRefundStatus={paymentSummary?.order.paymentRefundStatus}
      />

      <AdminOrderDetailClientLayout
        paymentSummary={paymentSummary}
        paymentSummaryError={paymentSummaryError}
        canExecuteRefunds={canExecuteRefunds}
        routingAvailable={routingAvailable}
        vendorRecoveryContexts={vendorRecoveryContexts}
        issuesPanel={{
          orderId: adminOrder.id,
          initialResolutionNotes: adminOrder.adminResolutionNotes ?? null,
          customerSupportIssues: adminOrder.issues
            .filter((i) => i.submittedByRole === "customer")
            .map((i) => ({
              id: i.id,
              issueType: i.type,
              status: i.status,
              priority: i.priority,
              vendorOrderId: i.vendorOrderId,
              vendorName: i.vendorOrder?.vendor.name ?? null,
              orderLineItemId: i.orderLineItemId,
              lineItemName: i.orderLineItem?.name ?? null,
              customerMessage: i.customerMessage,
              internalNote: i.internalNote ?? i.notes,
              linkedOrderRefundId: i.linkedOrderRefundId,
              linkedRefundStatus: i.linkedOrderRefund?.status ?? null,
              linkedRefundAmountCents: i.linkedOrderRefund?.amountCents ?? null,
              vendorResponse: i.vendorResponse,
              vendorRespondedAt: i.vendorRespondedAt?.toISOString() ?? null,
              vendorIssueStatus: i.vendorIssueStatus,
              createdAt: i.createdAt.toISOString(),
              updatedAt: i.updatedAt.toISOString(),
              resolvedAt: i.resolvedAt?.toISOString() ?? null,
            })),
          systemOrderIssues: adminOrder.issues
            .filter((i) => i.submittedByRole !== "customer")
            .map((i) => ({
              id: i.id,
              type: i.type,
              severity: i.severity,
              status: i.status,
              notes: i.notes,
              createdAt: i.createdAt.toISOString(),
              resolvedAt: i.resolvedAt?.toISOString() ?? null,
            })),
          vendorOrderIssues: adminOrder.vendorOrders.flatMap((vo) =>
            vo.issues.map((i) => ({
              id: i.id,
              vendorOrderId: vo.id,
              vendorName: vo.vendor.name,
              type: i.type,
              severity: i.severity,
              status: i.status,
              notes: i.notes,
              createdAt: i.createdAt.toISOString(),
              resolvedAt: i.resolvedAt?.toISOString() ?? null,
            }))
          ),
          orderRefundOptions: adminOrder.orderRefunds.map((r) => ({
            id: r.id,
            label: `${r.refundScope} · $${(r.amountCents / 100).toFixed(2)} · ${r.status}`,
          })),
        }}
      >
        <section className={ADMIN_SECTION_CARD}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-oo-stone-gray">
            Vendor orders
          </h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Fulfillment status per vendor — expand technical routing details when debugging.
          </p>
          <div className="mt-4 space-y-4">
            {vendorContexts.map(
              ({ vo, showRecoveredBadge, showProgressionUi, progressionTargetsFiltered, showRecheck }) => (
                <div key={vo.id} id={`vendor-order-${vo.id}`} className="scroll-mt-4">
                  <AdminVendorOrderCard
                    vo={vo}
                    showRecoveredBadge={showRecoveredBadge}
                    showProgressionUi={showProgressionUi}
                    progressionTargetsFiltered={progressionTargetsFiltered}
                    showRecheck={showRecheck}
                    refundAttempts={adminOrder.refundAttempts}
                  />
                </div>
              )
            )}
          </div>
        </section>

        {showAdminTestTools && (
          <AdminOrderQaToolsSection
            orderStatus={adminOrder.status}
            vendorOrders={adminOrder.vendorOrders}
          />
        )}
      </AdminOrderDetailClientLayout>

      <AdminOrderTimelineSection timeline={timeline} />

      <AdminOrderTechnicalDetailsSection adminOrder={adminOrder} paymentSummary={paymentSummary} />
    </div>
  );
}
