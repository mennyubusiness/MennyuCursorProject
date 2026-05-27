"use client";

import { useCallback, useState } from "react";
import type { AdminRefundScopeKey } from "@/lib/admin-refund-idempotency";
import type { LinkedIssueRefundContext } from "@/lib/admin-order-issue-refund-link";
import type { AdminOrderPaymentSummary } from "@/services/admin-order-payment-summary.service";
import { customerSupportIssueTypeLabel } from "@/domain/order-support-issue";
import { AdminPaymentsRefundsPanel } from "./AdminPaymentsRefundsPanel";
import { AdminOrderIssuesPanel } from "./AdminOrderIssuesPanel";

type CustomerSupportIssueRow = Parameters<
  typeof AdminOrderIssuesPanel
>[0]["customerSupportIssues"][number];

type IssuesPanelProps = Omit<
  Parameters<typeof AdminOrderIssuesPanel>[0],
  "onRefundFromIssue"
>;

export function AdminOrderIssuesRefundsBridge({
  paymentSummary,
  paymentSummaryError,
  canExecuteRefunds,
  issuesPanel,
}: {
  paymentSummary: AdminOrderPaymentSummary | null;
  paymentSummaryError: string | null;
  canExecuteRefunds: boolean;
  issuesPanel: IssuesPanelProps;
}) {
  const [linkedIssue, setLinkedIssue] = useState<LinkedIssueRefundContext | null>(null);
  const [openRefundModal, setOpenRefundModal] = useState<{
    kind: AdminRefundScopeKey;
    vendorOrderId?: string;
    orderLineItemId?: string;
  } | null>(null);

  const handleRefundFromIssue = useCallback(
    (issue: CustomerSupportIssueRow) => {
      const kind: AdminRefundScopeKey = issue.orderLineItemId
        ? "line_item_refund"
        : issue.vendorOrderId
          ? "full_vendor_order"
          : "full_order";
      setLinkedIssue({
        issueId: issue.id,
        issueType: issue.issueType,
        issueTypeLabel: customerSupportIssueTypeLabel(issue.issueType),
        customerMessage: issue.customerMessage,
        vendorOrderId: issue.vendorOrderId,
        vendorName: issue.vendorName,
        orderLineItemId: issue.orderLineItemId,
        lineItemName: issue.lineItemName,
      });
      setOpenRefundModal({
        kind,
        vendorOrderId: issue.vendorOrderId ?? undefined,
        orderLineItemId: issue.orderLineItemId ?? undefined,
      });
      document.getElementById("payments-refunds")?.scrollIntoView({ behavior: "smooth" });
    },
    []
  );

  const clearLinkedIssue = useCallback(() => {
    setLinkedIssue(null);
    setOpenRefundModal(null);
  }, []);

  return (
    <>
      {paymentSummaryError ? (
        <section
          id="payments-refunds"
          className="scroll-mt-4 rounded-lg border border-red-300 bg-red-50 p-4"
          role="alert"
        >
          <h2 className="text-lg font-semibold text-red-950">Payments &amp; Refunds</h2>
          <p className="mt-2 text-sm text-red-900">{paymentSummaryError}</p>
          <p className="mt-2 text-xs text-red-800">
            Apply pending Prisma migrations before issuing refunds from an issue.
          </p>
        </section>
      ) : paymentSummary ? (
        <AdminPaymentsRefundsPanel
          summary={paymentSummary}
          canExecuteRefunds={canExecuteRefunds}
          linkedIssue={linkedIssue}
          openRefundModal={openRefundModal}
          onRefundModalClosed={clearLinkedIssue}
        />
      ) : null}

      <AdminOrderIssuesPanel
        {...issuesPanel}
        canExecuteRefunds={canExecuteRefunds}
        onRefundFromIssue={canExecuteRefunds ? handleRefundFromIssue : undefined}
      />
    </>
  );
}
