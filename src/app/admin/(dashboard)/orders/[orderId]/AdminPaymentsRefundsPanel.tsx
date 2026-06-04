"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AdminRefundScopeKey } from "@/lib/admin-refund-idempotency";
import {
  formatAdminMoney,
  paymentRefundStatusLabel,
  refundModalTitle,
  refundScopeLabel,
  refundStatusLabel,
  transferToneClass,
} from "@/lib/admin-refund-ui";
import type {
  AdminOrderPaymentSummary,
  AdminOrderPaymentSummaryRefund,
  AdminOrderRefundLedgerRow,
} from "@/services/admin-order-payment-summary.service";
import { formatPrepareMissingReversalError } from "@/lib/admin-refund-prepare-ui";
import {
  legacyClawbackReviewStatusLabel,
  type LegacyClawbackReviewStatus,
} from "@/lib/legacy-clawback-review";
import { StripeMoneyMovementBreakdown } from "@/components/admin/StripeMoneyMovementBreakdown";
import { adminVendorConnectTransferStatusLabel } from "@/lib/stripe-money-movement";
import { vendorClawbackStatusBadgeClass } from "@/lib/vendor-clawback-status";
import type { AdminRefundPreviewPayload } from "@/lib/admin-refund-preview.types";
import {
  formatAdminRefundBlockingReason,
  formatAdminRefundCapErrorMessage,
} from "@/lib/admin-refund-error-messages";
import type { LinkedIssueRefundContext } from "@/lib/admin-order-issue-refund-link";
import { adminPrepareMissingTransferReversalAction } from "@/actions/admin-payout-transfer-reversal.actions";
import { orderHasUnresolvedClawback } from "@/lib/admin-order-health";

type ModalKind = AdminRefundScopeKey | null;

function LegacyClawbackReviewActions({
  vendorPayoutTransferId,
  stripeTransferId,
  needsReview,
  review,
  onComplete,
}: {
  vendorPayoutTransferId: string;
  stripeTransferId: string | null;
  needsReview: boolean;
  review: {
    status: string | null;
    note: string | null;
    reviewedAt: string | null;
    reviewedBy: string | null;
  };
  onComplete: () => void;
}) {
  const [note, setNote] = useState(review.note ?? "");
  const [pendingStatus, setPendingStatus] = useState<LegacyClawbackReviewStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(status: LegacyClawbackReviewStatus) {
    const trimmed = note.trim();
    if (!trimmed) {
      setError("An admin note is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/vendor-payout-transfers/${vendorPayoutTransferId}/legacy-clawback-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, note: trimmed }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || data.ok === false) {
        setError(data.error ?? "Could not save legacy review.");
        return;
      }
      setPendingStatus(null);
      onComplete();
    } finally {
      setBusy(false);
    }
  }

  if (!needsReview && review.status) {
    return (
      <div className="mt-1 rounded border border-violet-200 bg-violet-50/80 px-2 py-1.5 text-[10px] text-violet-950">
        <p className="font-semibold">
          Legacy clawback {legacyClawbackReviewStatusLabel(review.status).toLowerCase()}
          {review.reviewedAt ? ` · ${new Date(review.reviewedAt).toLocaleString()}` : ""}
        </p>
        {review.note ? <p className="mt-0.5 leading-snug">{review.note}</p> : null}
      </div>
    );
  }

  if (!needsReview) return null;

  return (
    <div className="mt-1.5 space-y-1.5 rounded border border-violet-200 bg-violet-50/80 px-2 py-2 text-[10px] text-violet-950">
      <p className="font-semibold">Legacy clawback review required</p>
      <p className="leading-snug">
        Refund evidence is incomplete, so Open Order cannot safely prepare an automatic vendor reversal.
      </p>
      {stripeTransferId ? (
        <p className="font-mono text-[9px] text-violet-900">Stripe transfer {shortenId(stripeTransferId)}</p>
      ) : null}
      {pendingStatus ? (
        <>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Admin note (required) — what you verified in Stripe"
            className="w-full rounded border border-violet-200 bg-white px-2 py-1 text-[10px] text-oo-charcoal"
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(pendingStatus)}
              className="rounded border border-violet-400 bg-violet-200 px-2 py-0.5 font-semibold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPendingStatus(null)}
              className="rounded border border-violet-200 px-2 py-0.5"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingStatus("reviewed")}
            className="rounded border border-violet-400 bg-violet-200 px-2 py-0.5 font-semibold disabled:opacity-50"
          >
            Mark reviewed
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setPendingStatus("deferred")}
            className="rounded border border-violet-200 bg-white px-2 py-0.5 font-semibold disabled:opacity-50"
          >
            Defer
          </button>
          <Link
            href="/admin/exceptions"
            className="rounded border border-violet-200 bg-white px-2 py-0.5 font-semibold text-violet-950 underline"
          >
            Issues queue
          </Link>
        </div>
      )}
      {error ? <p className="text-red-800">{error}</p> : null}
    </div>
  );
}

function shortenId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 20) return id;
  return `${id.slice(0, 14)}…${id.slice(-4)}`;
}

function InFlightRefundBlockersPanel({
  blockers,
}: {
  blockers: AdminRefundPreviewPayload["inFlightRefundBlockers"];
}) {
  if (blockers.length === 0) return null;
  return (
    <div className="rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-950">
      <p className="font-semibold">Refund in progress</p>
      <ul className="mt-1 space-y-1">
        {blockers.map((b) => (
          <li key={`${b.source}:${b.id}`}>
            {b.source === "order_refund" ? "Refund ledger entry is pending" : "Refund attempt in flight"} ·{" "}
            {formatAdminMoney(b.amountCents)} · {b.status} · id {shortenId(b.id)}
            {b.stripeRefundId ? ` · Stripe ${shortenId(b.stripeRefundId)}` : " · no Stripe refund ID"}
            {b.createdAt ? ` · ${new Date(b.createdAt).toLocaleString()}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PreviewBlock({ preview }: { preview: AdminRefundPreviewPayload }) {
  return (
    <div className="mt-4 space-y-3 rounded-lg border border-oo-light-stone bg-oo-cream/60 p-3 text-sm">
      <p className="font-medium text-oo-charcoal">Refund preview</p>
      <dl className="grid gap-1">
        <div className="flex justify-between gap-4">
          <dt className="text-oo-stone-gray">Customer refund</dt>
          <dd className="font-medium tabular-nums">
            {formatAdminMoney(preview.customerRefundAmountCents)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-oo-stone-gray">Remaining (order)</dt>
          <dd className="tabular-nums">{formatAdminMoney(preview.remainingOrderRefundableCents)}</dd>
        </div>
        {preview.remainingVendorOrderRefundableCents != null && (
          <div className="flex justify-between gap-4">
            <dt className="text-oo-stone-gray">Remaining (vendor)</dt>
            <dd className="tabular-nums">
              {formatAdminMoney(preview.remainingVendorOrderRefundableCents)}
            </dd>
          </div>
        )}
      </dl>

      <div className="border-t border-oo-light-stone pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
          Customer refund vs vendor transfer reversal
        </p>
        <ul className="mt-1 space-y-1 text-xs">
          <li>
            <span className="font-medium">Customer refund:</span>{" "}
            {formatAdminMoney(preview.customerRefundAmountCents)} from platform balance
          </li>
          <li>
            <span className="font-medium">Transfer reversal required:</span>{" "}
            {preview.transferReversalRequired ? "Yes" : "No"}
          </li>
          <li>
            <span className="font-medium">Reversal possible now:</span>{" "}
            {preview.transferReversalPossible ? "Yes" : "No"}
            {preview.estimatedTransferReversalAmountCents > 0 &&
              ` (est. ${formatAdminMoney(preview.estimatedTransferReversalAmountCents)})`}
          </li>
          <li>
            <span className="font-medium">Open Order absorbs cost:</span>{" "}
            {preview.platformWouldAbsorbRefund ? "Yes — no vendor clawback" : "No"}
          </li>
        </ul>
      </div>

      {preview.vendorPayoutTransfers.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-oo-stone-gray">Affected transfers</p>
          <ul className="mt-1 space-y-1 text-xs">
            {preview.vendorPayoutTransfers.map((t) => (
              <li key={t.paymentAllocationId} className="rounded border border-oo-light-stone bg-white/80 p-2">
                Vendor slice · {t.transferStatus} · net transfer{" "}
                {formatAdminMoney(t.netVendorTransferCents)}
                {t.reversalRequired && (
                  <span className="ml-1 font-medium text-amber-800">· reversal may be required</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.warnings.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          <p className="font-semibold">Warnings</p>
          <ul className="mt-1 list-disc pl-4">
            {preview.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {preview.lineItem && (
        <div className="border-t border-oo-light-stone pt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Line item
          </p>
          <dl className="mt-1 grid gap-1 text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Item</dt>
              <dd className="font-medium">{preview.lineItem.itemName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Purchased qty</dt>
              <dd className="tabular-nums">{preview.lineItem.purchasedQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Already refunded qty</dt>
              <dd className="tabular-nums">{preview.lineItem.alreadyRefundedQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Refundable qty</dt>
              <dd className="tabular-nums">{preview.lineItem.refundableQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Requested qty</dt>
              <dd className="tabular-nums">{preview.lineItem.requestedQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-oo-stone-gray">Subtotal</dt>
              <dd className="tabular-nums">
                {formatAdminMoney(preview.lineItem.subtotalRefundedCents)}
              </dd>
            </div>
            {preview.lineItem.taxRefundedCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Tax</dt>
                <dd className="tabular-nums">
                  {formatAdminMoney(preview.lineItem.taxRefundedCents)}
                </dd>
              </div>
            )}
            {preview.lineItem.tipRefundedCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Tip</dt>
                <dd className="tabular-nums">
                  {formatAdminMoney(preview.lineItem.tipRefundedCents)}
                </dd>
              </div>
            )}
            {preview.lineItem.serviceFeeRefundedCents > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-oo-stone-gray">Service fee</dt>
                <dd className="tabular-nums">
                  {formatAdminMoney(preview.lineItem.serviceFeeRefundedCents)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {preview.inFlightRefundBlockers.length > 0 && (
        <InFlightRefundBlockersPanel blockers={preview.inFlightRefundBlockers} />
      )}

      {preview.staleBlockingRefundAttempts.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
          <p className="font-semibold">Stale refund attempt blocking refunds</p>
          <ul className="mt-1 space-y-1">
            {preview.staleBlockingRefundAttempts.map((a) => (
              <li key={a.id}>
                {formatAdminMoney(a.amountCents)} · {a.status}
                {a.failureMessage ? ` · ${a.failureMessage}` : ""}
              </li>
            ))}
          </ul>
          <p className="mt-1">
            Dismiss the stale attempt from the Payments &amp; Refunds section before confirming.
          </p>
        </div>
      )}

      {preview.blockingReasons.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-950">
          <p className="font-semibold">Cannot proceed</p>
          <ul className="mt-1 list-disc pl-4">
            {preview.blockingReasons.map((b) => (
              <li key={b}>{formatAdminRefundBlockingReason(b)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LinkedIssueBanner({ linkedIssue }: { linkedIssue: LinkedIssueRefundContext }) {
  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50/80 p-3 text-sm text-blue-950">
      <p className="font-medium">Linked issue: {linkedIssue.issueTypeLabel}</p>
      {linkedIssue.customerMessage && (
        <p className="mt-1 text-xs">
          Customer: &ldquo;{linkedIssue.customerMessage.slice(0, 200)}
          {linkedIssue.customerMessage.length > 200 ? "…" : ""}&rdquo;
        </p>
      )}
      {(linkedIssue.vendorName || linkedIssue.lineItemName) && (
        <p className="mt-1 text-xs text-blue-900/80">
          {linkedIssue.vendorName && <span>Vendor: {linkedIssue.vendorName}</span>}
          {linkedIssue.vendorName && linkedIssue.lineItemName && " · "}
          {linkedIssue.lineItemName && <span>Item: {linkedIssue.lineItemName}</span>}
        </p>
      )}
      <p className="mt-1 text-xs text-blue-800/90">
        A successful refund will link to this issue. The issue stays open until you resolve it.
      </p>
    </div>
  );
}

function RefundModal({
  orderId,
  kind,
  summary,
  initialVendorOrderId,
  initialOrderLineItemId,
  linkedIssue,
  onClose,
}: {
  orderId: string;
  kind: AdminRefundScopeKey;
  summary: AdminOrderPaymentSummary;
  initialVendorOrderId?: string;
  initialOrderLineItemId?: string;
  linkedIssue?: LinkedIssueRefundContext | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [customerVisibleNote, setCustomerVisibleNote] = useState("");
  const [vendorOrderId, setVendorOrderId] = useState(initialVendorOrderId ?? summary.vendorOrders[0]?.id ?? "");
  const [orderLineItemId, setOrderLineItemId] = useState(
    initialOrderLineItemId ??
      summary.vendorOrders.find((v) => v.id === (initialVendorOrderId ?? summary.vendorOrders[0]?.id))
        ?.lineItems[0]?.id ??
      ""
  );
  const [quantity, setQuantity] = useState(1);
  const [includeTax, setIncludeTax] = useState(true);
  const [includeTip, setIncludeTip] = useState(false);
  const [includeServiceFee, setIncludeServiceFee] = useState(false);
  const [amountDollars, setAmountDollars] = useState("");
  const [platformAbsorbsRefund, setPlatformAbsorbsRefund] = useState(false);
  const [preview, setPreview] = useState<AdminRefundPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  const selectedVo = summary.vendorOrders.find((v) => v.id === vendorOrderId);
  const selectedLineItem = selectedVo?.lineItems.find((li) => li.id === orderLineItemId);
  const lineItemTransferRisk =
    selectedVo?.transferStatus === "paid" || selectedVo?.transferStatus === "submitted";
  const adminNoteRequired =
    kind === "custom_vendor_partial" ||
    platformAbsorbsRefund ||
    (kind === "line_item_refund" && !linkedIssue?.customerMessage?.trim());

  const amountCents = useMemo(() => {
    if (kind === "full_order") return summary.order.remainingRefundableCents;
    if (kind === "full_vendor_order") return selectedVo?.remainingRefundableCents ?? 0;
    const parsed = Math.round(parseFloat(amountDollars || "0") * 100);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [kind, summary, selectedVo, amountDollars]);

  const buildBody = useCallback(() => {
    const body: Record<string, unknown> = {
      scope: kind,
      reason: reason.trim(),
      adminNote: adminNote.trim() || null,
      customerVisibleNote: customerVisibleNote.trim() || null,
    };
    if (linkedIssue?.issueId) {
      body.linkedOrderIssueId = linkedIssue.issueId;
    }
    if (kind !== "full_order") {
      body.vendorOrderId = vendorOrderId;
    }
    if (kind === "custom_vendor_partial") {
      body.amountCents = amountCents;
      body.platformAbsorbsRefund = platformAbsorbsRefund;
    }
    if (kind === "line_item_refund") {
      body.orderLineItemId = orderLineItemId;
      body.quantity = quantity;
      body.includeTax = includeTax;
      body.includeTip = includeTip;
      body.includeServiceFee = includeServiceFee;
      body.platformAbsorbsRefund = platformAbsorbsRefund;
    }
    return body;
  }, [
    kind,
    reason,
    adminNote,
    customerVisibleNote,
    vendorOrderId,
    orderLineItemId,
    quantity,
    includeTax,
    includeTip,
    includeServiceFee,
    amountCents,
    platformAbsorbsRefund,
    linkedIssue?.issueId,
  ]);

  async function runPreview() {
    setPreviewError(null);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refunds/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreviewError(data.error ?? `Preview failed (${res.status})`);
        return;
      }
      setPreview(data.preview ?? null);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function runExecute() {
    setExecuteError(null);
    setExecuteSuccess(null);
    setExecuting(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const friendlyMessage = formatAdminRefundCapErrorMessage({
          code: typeof data.code === "string" ? data.code : "",
          message:
            typeof data.message === "string"
              ? data.message
              : typeof data.error === "string"
                ? data.error
                : undefined,
        });
        setExecuteError(friendlyMessage);
        if (data.blockingReasons) {
          setPreview((p) =>
            p
              ? { ...p, blockingReasons: data.blockingReasons }
              : {
                  orderId,
                  vendorOrderId: kind === "full_order" ? null : vendorOrderId,
                  refundScope: kind,
                  customerRefundAmountCents: amountCents,
                  remainingOrderRefundableCents: summary.order.remainingRefundableCents,
                  remainingVendorOrderRefundableCents: selectedVo?.remainingRefundableCents ?? null,
                  paymentAllocations: [],
                  vendorPayoutTransfers: [],
                  transferReversalRequired: false,
                  transferReversalPossible: false,
                  estimatedTransferReversalAmountCents: 0,
                  platformWouldAbsorbRefund: false,
                  platformAbsorptionPermanent: false,
                  warnings: [],
                  blockingReasons: data.blockingReasons,
                  idempotencyKey: "",
                  hasPendingRefund: false,
                  inFlightRefundReservedCents: 0,
                  staleBlockingRefundAttempts: [],
                  inFlightRefundBlockers: [],
                }
          );
        }
        if (
          data.code === "REFUND_AVAILABILITY_CHANGED" ||
          data.code === "REFUND_IN_PROGRESS" ||
          data.code === "ORDER_ALREADY_FULLY_REFUNDED" ||
          data.code === "STALE_REFUND_ATTEMPT_BLOCKS_REFUND"
        ) {
          void runPreview();
        }
        return;
      }
      const reversalNote =
        data.transferReversal?.outcome === "created_pending"
          ? " Vendor transfer reversal rows were prepared — execute reversals from the vendor transfer reversals workflow."
          : data.transferReversal?.reason === "platform_absorbs_refund_no_transfer_reversal"
            ? " Open Order is bearing this refund; no vendor transfer reversal was prepared."
            : data.transferReversal?.outcome === "skipped_ineligible" ||
                data.transferReversal?.outcome === "skipped_no_paid_transfers"
              ? " No vendor transfer reversal rows were needed or eligible."
              : "";
      setExecuteSuccess(
        (data.success
          ? data.idempotent
            ? "Refund already completed (idempotent)."
            : `Customer refund ${data.stripeRefundId ? "submitted" : "recorded"}.${reversalNote}`
          : data.message) ?? "Done."
      );
      router.refresh();
    } catch (e) {
      setExecuteError(e instanceof Error ? e.message : String(e));
    } finally {
      setExecuting(false);
    }
  }

  const canPreview =
    reason.trim().length > 0 &&
    (kind === "full_order" ||
      (kind === "full_vendor_order" && vendorOrderId) ||
      (kind === "custom_vendor_partial" &&
        vendorOrderId &&
        adminNote.trim().length > 0 &&
        amountCents > 0) ||
      (kind === "line_item_refund" &&
        vendorOrderId &&
        orderLineItemId &&
        quantity > 0 &&
        (!adminNoteRequired || adminNote.trim().length > 0)));

  const confirmDisabled =
    !preview ||
    preview.blockingReasons.length > 0 ||
    executing ||
    previewLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <h3 id="refund-modal-title" className="text-lg font-semibold text-oo-charcoal">
            {refundModalTitle(kind)}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-oo-stone-gray hover:underline"
            disabled={executing}
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-xs text-oo-stone-gray">
          This refunds the customer from Open Order&apos;s platform balance. Vendor transfer
          reversal, if needed, is a separate manual workflow.
        </p>

        {linkedIssue && <LinkedIssueBanner linkedIssue={linkedIssue} />}

        {kind !== "full_order" && (
          <label className="mt-4 block text-sm">
            <span className="font-medium text-oo-charcoal">Vendor order</span>
            <select
              className="mt-1 w-full rounded border border-oo-light-stone bg-white px-2 py-1.5 text-sm"
              value={vendorOrderId}
              onChange={(e) => {
                setVendorOrderId(e.target.value);
                setPreview(null);
              }}
              disabled={Boolean(initialVendorOrderId && kind !== "line_item_refund")}
            >
              {summary.vendorOrders.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorName} — {formatAdminMoney(v.remainingRefundableCents)} remaining
                </option>
              ))}
            </select>
          </label>
        )}

        {kind === "line_item_refund" && selectedVo && (
          <>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-oo-charcoal">Line item</span>
              <select
                className="mt-1 w-full rounded border border-oo-light-stone bg-white px-2 py-1.5 text-sm"
                value={orderLineItemId}
                onChange={(e) => {
                  setOrderLineItemId(e.target.value);
                  setPreview(null);
                }}
                disabled={Boolean(initialOrderLineItemId)}
              >
                {selectedVo.lineItems.map((li) => (
                  <option key={li.id} value={li.id}>
                    {li.name} × {li.quantity} @ {formatAdminMoney(li.priceCents)} each
                  </option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-oo-charcoal">Quantity to refund</span>
              <input
                type="number"
                min={1}
                max={selectedLineItem?.quantity ?? 99}
                step={1}
                className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-sm tabular-nums"
                value={quantity}
                onChange={(e) => {
                  setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1));
                  setPreview(null);
                }}
              />
            </label>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeTax}
                  onChange={(e) => {
                    setIncludeTax(e.target.checked);
                    setPreview(null);
                  }}
                />
                Include proportional tax
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeTip}
                  onChange={(e) => {
                    setIncludeTip(e.target.checked);
                    setPreview(null);
                  }}
                />
                Include proportional tip
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeServiceFee}
                  onChange={(e) => {
                    setIncludeServiceFee(e.target.checked);
                    setPreview(null);
                  }}
                />
                Include proportional service fee
              </label>
            </div>
            {(lineItemTransferRisk || preview?.platformWouldAbsorbRefund) && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
                <p className="font-medium">
                  Vendor transfer is {selectedVo.transferStatus}. Line-item refunds do not prepare
                  transfer reversals.
                </p>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={platformAbsorbsRefund}
                    onChange={(e) => {
                      setPlatformAbsorbsRefund(e.target.checked);
                      setPreview(null);
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    Open Order will bear this refund (platformAbsorbsRefund). Admin note is required.
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        {kind === "custom_vendor_partial" && selectedVo && (
          <>
            <label className="mt-3 block text-sm">
              <span className="font-medium text-oo-charcoal">Amount (USD)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-sm tabular-nums"
                value={amountDollars}
                onChange={(e) => {
                  setAmountDollars(e.target.value);
                  setPreview(null);
                }}
              />
              <span className="mt-0.5 block text-xs text-oo-stone-gray">
                Max {formatAdminMoney(selectedVo.remainingRefundableCents)} for this vendor
              </span>
            </label>
            {selectedVo.partialRefundWouldRequirePlatformAbsorption && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-950">
                <p className="font-medium">
                  This vendor transfer has already been sent. Partial transfer reversal is not
                  supported yet.
                </p>
                <label className="mt-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={platformAbsorbsRefund}
                    onChange={(e) => {
                      setPlatformAbsorbsRefund(e.target.checked);
                      setPreview(null);
                    }}
                    className="mt-0.5"
                  />
                  <span>
                    Open Order will bear this refund (platformAbsorbsRefund). No vendor transfer
                    reversal will be prepared. Admin note is required.
                  </span>
                </label>
              </div>
            )}
          </>
        )}

        <label className="mt-3 block text-sm">
          <span className="font-medium text-oo-charcoal">Reason (required)</span>
          <textarea
            className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-sm"
            rows={2}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setPreview(null);
            }}
          />
        </label>

        <label className="mt-3 block text-sm">
          <span className="font-medium text-oo-charcoal">
            Admin note
            {adminNoteRequired ? " (required)" : " (optional)"}
          </span>
          <textarea
            className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-sm"
            rows={2}
            value={adminNote}
            onChange={(e) => {
              setAdminNote(e.target.value);
              setPreview(null);
            }}
          />
        </label>

        <label className="mt-3 block text-sm">
          <span className="font-medium text-oo-charcoal">Customer-visible note (optional)</span>
          <textarea
            className="mt-1 w-full rounded border border-oo-light-stone px-2 py-1.5 text-sm"
            rows={2}
            value={customerVisibleNote}
            onChange={(e) => setCustomerVisibleNote(e.target.value)}
          />
        </label>

        {kind === "full_order" && (
          <p className="mt-3 text-sm">
            Refund amount:{" "}
            <span className="font-semibold tabular-nums">
              {formatAdminMoney(summary.order.remainingRefundableCents)}
            </span>
          </p>
        )}
        {kind === "full_vendor_order" && selectedVo && (
          <div className="mt-3 rounded border border-oo-light-stone bg-oo-cream/50 p-2 text-xs">
            <p>
              <span className="font-medium">{selectedVo.vendorName}</span> · transfer{" "}
              {selectedVo.transferStatus ?? "missing"}
            </p>
            <p className={`mt-1 rounded border px-2 py-1 ${transferToneClass(selectedVo.transferMessage.tone)}`}>
              {selectedVo.transferMessage.message}
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runPreview}
            disabled={!canPreview || previewLoading || executing}
            className="rounded bg-oo-charcoal px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {previewLoading ? "Previewing…" : "Preview refund"}
          </button>
        </div>

        {previewError && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {previewError}
          </p>
        )}
        {preview && <PreviewBlock preview={preview} />}

        {executeSuccess && (
          <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-900">
            {executeSuccess}
          </p>
        )}
        {executeError && (
          <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-900" role="alert">
            {executeError}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-oo-light-stone pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-oo-light-stone px-3 py-1.5 text-sm"
            disabled={executing}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runExecute}
            disabled={confirmDisabled}
            className="rounded bg-red-800 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {executing ? "Processing…" : "Confirm customer refund"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RefundsTable({
  rows,
  inconsistentLedger,
}: {
  rows: AdminOrderRefundLedgerRow[];
  inconsistentLedger: boolean;
}) {
  if (rows.length === 0) {
    if (inconsistentLedger) {
      return (
        <p className="mt-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          Refund total exists, but no refund ledger entry was found. This may be legacy or inconsistent
          data.
        </p>
      );
    }
    return <p className="mt-2 text-sm text-oo-stone-gray">No refunds recorded yet.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto">
      {inconsistentLedger ? (
        <p className="mb-2 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-950">
          Order totals show a refund, but ledger rows may be incomplete. Review before preparing vendor
          reversal.
        </p>
      ) : null}
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-oo-light-stone text-xs uppercase tracking-wide text-oo-stone-gray">
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Source</th>
            <th className="px-2 py-2">Scope</th>
            <th className="px-2 py-2">Vendor</th>
            <th className="px-2 py-2">Amount</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Stripe</th>
            <th className="px-2 py-2">Refund attempt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-oo-light-stone/80">
              <td className="px-2 py-2 text-xs text-oo-stone-gray">
                {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
              </td>
              <td className="px-2 py-2 text-xs">
                {r.source === "legacy_refund_attempt" ? "Legacy attempt" : "Ledger"}
              </td>
              <td className="px-2 py-2">
                {r.refundScope ? refundScopeLabel(r.refundScope) : "—"}
              </td>
              <td className="px-2 py-2">{r.vendorName ?? "—"}</td>
              <td className="px-2 py-2 tabular-nums">{formatAdminMoney(r.amountCents)}</td>
              <td className="px-2 py-2">
                <span
                  className={
                    r.status === "failed"
                      ? "font-medium text-red-800"
                      : r.status === "succeeded"
                        ? "text-emerald-800"
                        : r.status === "pending"
                          ? "text-amber-800"
                          : ""
                  }
                >
                  {refundStatusLabel(r.status)}
                </span>
              </td>
              <td className="px-2 py-2 font-mono text-xs">{shortenId(r.stripeRefundId)}</td>
              <td className="px-2 py-2 font-mono text-xs">
                {r.refundAttemptId ? shortenId(r.refundAttemptId) : "—"}
                {r.refundAttemptStatus ? (
                  <span className="block text-oo-stone-gray">{r.refundAttemptStatus}</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StaleRefundAttemptBanner({
  attempts,
  canDismiss,
}: {
  attempts: NonNullable<AdminOrderPaymentSummary["ledgerSummary"]>["staleBlockingRefundAttempts"];
  canDismiss: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (attempts.length === 0) return null;

  async function dismiss(refundAttemptId: string) {
    setBusyId(refundAttemptId);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/refund-attempts/${refundAttemptId}/dismiss-legacy`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not dismiss stale refund attempt.");
        return;
      }
      setConfirmId(null);
      setSuccess("Stale refund attempt dismissed. Preview the refund again.");
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/90 p-3 text-sm text-amber-950">
      <p className="font-medium">Legacy refund attempt blocking new refunds</p>
      <p className="mt-1 text-xs text-amber-900/90">
        This legacy refund attempt did not create a refund ledger entry or Stripe refund, but it is
        blocking new refunds. Dismiss it to retry the refund flow.
      </p>
      <ul className="mt-2 space-y-2">
        {attempts.map((a) => (
          <li key={a.id} className="rounded border border-amber-200/80 bg-white/70 p-2 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p>
                  <span className="font-medium">{formatAdminMoney(a.amountCents)}</span> · status{" "}
                  {a.status} · {new Date(a.createdAt).toLocaleString()}
                </p>
                {a.failureMessage && <p className="mt-1 text-amber-900/90">{a.failureMessage}</p>}
                <p className="mt-1 text-amber-900/80">
                  Stripe refund ID: {a.stripeRefundId ?? "none"}
                </p>
              </div>
              {canDismiss && a.dismissible && confirmId !== a.id && (
                <button
                  type="button"
                  className="rounded border border-amber-300 bg-white px-2 py-1 text-xs font-medium hover:bg-amber-50"
                  onClick={() => setConfirmId(a.id)}
                  disabled={busyId != null}
                >
                  Dismiss stale refund attempt
                </button>
              )}
            </div>
            {confirmId === a.id && (
              <div className="mt-2 border-t border-amber-200 pt-2">
                <p className="text-xs">Dismiss this stale attempt so a new refund can be processed?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded bg-amber-900 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                    disabled={busyId === a.id}
                    onClick={() => void dismiss(a.id)}
                  >
                    {busyId === a.id ? "Dismissing…" : "Confirm dismiss"}
                  </button>
                  <button
                    type="button"
                    className="rounded border border-amber-300 px-2 py-1 text-xs"
                    disabled={busyId === a.id}
                    onClick={() => setConfirmId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!a.dismissible && a.dismissBlockReason && (
              <p className="mt-1 text-red-800">{a.dismissBlockReason.replace(/_/g, " ")}</p>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 text-xs text-emerald-900" role="status">
          {success}
        </p>
      )}
    </div>
  );
}

export function AdminPaymentsRefundsPanel({
  summary,
  canExecuteRefunds,
  linkedIssue,
  openRefundModal,
  onRefundModalClosed,
}: {
  summary: AdminOrderPaymentSummary;
  canExecuteRefunds: boolean;
  linkedIssue?: LinkedIssueRefundContext | null;
  openRefundModal?: {
    kind: AdminRefundScopeKey;
    vendorOrderId?: string;
    orderLineItemId?: string;
  } | null;
  onRefundModalClosed?: () => void;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<{
    kind: AdminRefundScopeKey;
    vendorOrderId?: string;
    orderLineItemId?: string;
  } | null>(null);
  const [prepareBusyId, setPrepareBusyId] = useState<string | null>(null);
  const [prepareMessage, setPrepareMessage] = useState<string | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);

  useEffect(() => {
    if (openRefundModal) {
      setModal(openRefundModal);
    }
  }, [openRefundModal]);

  const payment = summary.payment;
  const hasRemaining = summary.order.remainingRefundableCents > 0;
  const primaryVendor = summary.vendorOrders[0];
  const orderMoneyMovement = summary.moneyMovement;

  const pendingReversalCount = summary.vendorOrders.reduce(
    (n, v) => n + v.reversals.filter((r) => r.status === "pending" || r.status === "submitted").length,
    0
  );
  const failedClawbackCount = summary.vendorOrders.filter(
    (v) => v.clawback.clawbackStatus === "failed"
  ).length;
  const pendingClawbackCount = summary.vendorOrders.filter(
    (v) => v.clawback.clawbackStatus === "pending"
  ).length;
  const highlightTransferBreakdown = orderHasUnresolvedClawback(summary);

  async function prepareMissingReversal(vendorPayoutTransferId: string) {
    setPrepareBusyId(vendorPayoutTransferId);
    setPrepareMessage(null);
    setPrepareError(null);
    try {
      const result = await adminPrepareMissingTransferReversalAction({
        orderId: summary.order.id,
        vendorPayoutTransferId,
      });
      if (!result.ok) {
        setPrepareError(formatPrepareMissingReversalError(result.error));
        return;
      }
      setPrepareMessage(
        "Vendor transfer reversal prepared. Run it from Vendor Transfers to submit it to Stripe."
      );
      router.refresh();
    } finally {
      setPrepareBusyId(null);
    }
  }

  return (
    <section
      id="payments-refunds"
      className="scroll-mt-4 rounded-xl border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-oo-charcoal">Payments &amp; refunds</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Customer refund = money returned to the customer. Vendor transfer = money sent to the
            vendor&apos;s Stripe account. Vendor clawback = funds recovered from the vendor after a
            refund. Run transfer reversals from{" "}
            <Link href="/admin/payout-transfers" className="font-medium text-oo-charcoal underline">
              Vendor Transfers
            </Link>
            .
          </p>
          {pendingReversalCount > 0 && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {pendingClawbackCount > 0
                ? `${pendingClawbackCount} vendor clawback(s) pending`
                : `${pendingReversalCount} transfer reversal row(s) need manual execution`}
              {" — "}
              prepared rows are not completed until processed in{" "}
              <Link href="/admin/payout-transfers" className="font-medium underline">
                vendor clawbacks / transfer reversals
              </Link>
              .
            </p>
          )}
          {failedClawbackCount > 0 && (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950" role="alert">
              {failedClawbackCount} vendor clawback(s) failed. Customer refund succeeded separately — retry
              the transfer reversal from{" "}
              <Link href="/admin/payout-transfers" className="font-medium underline">
                vendor clawbacks / transfer reversals
              </Link>{" "}
              or review in Needs Attention.
            </p>
          )}
          {prepareMessage ? (
            <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
              {prepareMessage}
            </p>
          ) : null}
          {prepareError ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950" role="alert">
              {prepareError}
            </p>
          ) : null}
        </div>
        <StaleRefundAttemptBanner
          attempts={summary.ledgerSummary?.staleBlockingRefundAttempts ?? []}
          canDismiss={canExecuteRefunds}
        />
        {(summary.ledgerSummary?.inFlightRefundBlockers.length ?? 0) > 0 && (
          <div className="mt-3">
            <InFlightRefundBlockersPanel
              blockers={summary.ledgerSummary?.inFlightRefundBlockers ?? []}
            />
          </div>
        )}
        {canExecuteRefunds && hasRemaining && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded border border-oo-light-stone bg-white px-3 py-1.5 text-sm font-medium hover:bg-oo-cream/80"
              onClick={() => setModal({ kind: "full_order" })}
            >
              Refund full order
            </button>
            <button
              type="button"
              className="rounded border border-oo-light-stone bg-white px-3 py-1.5 text-sm font-medium hover:bg-oo-cream/80"
              onClick={() => setModal({ kind: "full_vendor_order" })}
            >
              Refund vendor order
            </button>
            <button
              type="button"
              className="rounded border border-oo-light-stone bg-white px-3 py-1.5 text-sm font-medium hover:bg-oo-cream/80"
              onClick={() => setModal({ kind: "custom_vendor_partial" })}
            >
              Refund custom amount
            </button>
            <button
              type="button"
              className="rounded border border-oo-light-stone bg-white px-3 py-1.5 text-sm font-medium hover:bg-oo-cream/80"
              onClick={() => setModal({ kind: "line_item_refund" })}
            >
              Refund item
            </button>
          </div>
        )}
        {canExecuteRefunds && !hasRemaining && (
          <p className="text-xs text-oo-stone-gray">No remaining refundable balance on this order.</p>
        )}
        {!canExecuteRefunds && (
          <p className="text-xs text-oo-stone-gray">
            Refund actions require a platform-admin account (not admin secret bridge alone).
          </p>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2.5">
          <p className="text-xs text-oo-stone-gray">Customer paid</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-oo-charcoal">
            {formatAdminMoney(payment?.amountCents ?? summary.order.totalCents)}
          </p>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2.5">
          <p className="text-xs text-oo-stone-gray">Refunded</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-oo-charcoal">
            {formatAdminMoney(summary.refundDisplay.refundedCents)}
          </p>
          {summary.refundDisplay.inconsistentLedger ? (
            <p className="mt-0.5 text-[10px] text-violet-900">
              Denormalized total {formatAdminMoney(summary.refundDisplay.denormalizedRefundedCents)} ·
              no ledger rows
            </p>
          ) : null}
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2.5">
          <p className="text-xs text-oo-stone-gray">Refund status</p>
          <p className="mt-0.5 text-sm font-semibold text-oo-charcoal">
            {paymentRefundStatusLabel(summary.order.paymentRefundStatus)}
          </p>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 px-3 py-2.5">
          <p className="text-xs text-oo-stone-gray">Remaining refundable</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-oo-charcoal">
            {formatAdminMoney(summary.order.remainingRefundableCents)}
          </p>
        </div>
      </div>

      {summary.vendorOrders.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {summary.vendorOrders.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-oo-light-stone bg-oo-cream/30 px-3 py-2 text-sm"
            >
              <p className="font-medium text-oo-charcoal">{v.vendorName}</p>
              <p className="mt-0.5 text-xs text-oo-stone-gray">
                Vendor transfer:{" "}
                <span className="font-medium text-oo-charcoal">
                  {adminVendorConnectTransferStatusLabel(v.transferStatus ?? "missing")}
                </span>
                {v.clawback.clawbackStatus !== "not_needed" ? (
                  <>
                    {" · "}
                    Vendor clawback:{" "}
                    <span className="font-medium text-oo-charcoal">{v.clawback.adminLabel}</span>
                  </>
                ) : null}
              </p>
              {v.clawback.adminDetail ? (
                <p className="mt-0.5 text-xs leading-snug text-oo-stone-gray">{v.clawback.adminDetail}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <details className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/30 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-oo-charcoal hover:text-brand">
          Show Stripe details
        </summary>
        {orderMoneyMovement && primaryVendor ? (
          <div className="mt-3 border-t border-oo-light-stone pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
              Stripe money movement
            </h3>
            <div className="mt-2">
              <StripeMoneyMovementBreakdown
                customerPaymentCents={orderMoneyMovement.customerPaymentCents}
                stripeProcessingFeeCents={orderMoneyMovement.stripeProcessingFeeCents}
                stripeNetToPlatformCents={orderMoneyMovement.stripeNetToPlatformCents}
                platformPayout={orderMoneyMovement.platformPayout}
                vendorConnectTransferOwedCents={
                  primaryVendor.netVendorTransferCents ?? primaryVendor.transferAmountCents ?? 0
                }
                vendorConnectTransferStatus={primaryVendor.transferStatus ?? "missing"}
                vendorStillOwedCents={summary.vendorOrders.reduce(
                  (sum, v) => sum + v.vendorStillOwedCents,
                  0
                )}
                openOrderRetainedCents={orderMoneyMovement.openOrderRetainedCents}
                stripeTransferId={primaryVendor.stripeTransferId}
                showBlockedNote={summary.vendorOrders.some((v) => v.vendorStillOwedCents > 0)}
              />
            </div>
          </div>
        ) : null}
        <div className="mt-3 grid gap-4 border-t border-oo-light-stone pt-3 sm:grid-cols-2 text-sm">
          <dl className="space-y-1">
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Service fee</dt>
              <dd className="tabular-nums">{formatAdminMoney(summary.order.serviceFeeCents)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Tax</dt>
              <dd className="tabular-nums">{formatAdminMoney(summary.order.taxCents)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Tip</dt>
              <dd className="tabular-nums">{formatAdminMoney(summary.order.tipCents)}</dd>
            </div>
            {payment?.stripeProcessingFeeCents != null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-oo-stone-gray">Stripe processing fee</dt>
                <dd className="tabular-nums">{formatAdminMoney(payment.stripeProcessingFeeCents)}</dd>
              </div>
            ) : null}
            {orderMoneyMovement?.stripeNetToPlatformCents != null ? (
              <div className="flex justify-between gap-2">
                <dt className="text-oo-stone-gray">Stripe net to platform</dt>
                <dd className="tabular-nums">
                  {formatAdminMoney(orderMoneyMovement.stripeNetToPlatformCents)}
                </dd>
              </div>
            ) : null}
          </dl>
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-oo-stone-gray">PaymentIntent</dt>
              <dd className="break-all font-mono">
                {payment?.stripePaymentIntentId ?? summary.order.stripePaymentIntentId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Charge</dt>
              <dd className="break-all font-mono">
                {payment?.stripeChargeId ?? (
                  <span className="font-sans text-amber-800">Charge ID missing — may need reconciliation</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Balance transaction</dt>
              <dd className="break-all font-mono">{payment?.stripeBalanceTransactionId ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </details>

      <details
        className="mt-4 rounded-lg border border-oo-light-stone bg-oo-cream/30 px-3 py-2"
        open={highlightTransferBreakdown}
      >
        <summary className="cursor-pointer text-sm font-medium text-oo-charcoal hover:text-brand">
          Show vendor transfer accounting
        </summary>
        <p className="mt-2 text-xs text-oo-stone-gray">
          Full allocation table (gross payable, fee allocation, net transfer). Use Vendor Transfers
          to prepare or run reversals.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-oo-light-stone">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="sticky top-0 bg-oo-cream/90 backdrop-blur-sm">
              <tr className="border-b border-oo-light-stone text-xs uppercase tracking-wide text-oo-stone-gray">
                <th className="px-2 py-2">Vendor</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Customer total</th>
                <th className="px-2 py-2">Refunded</th>
                <th className="px-2 py-2">Remaining</th>
                <th className="px-2 py-2">Gross payable</th>
                <th className="px-2 py-2">Stripe fee alloc.</th>
                <th className="px-2 py-2">Net transfer</th>
                <th className="px-2 py-2">Vendor still owed</th>
                <th className="px-2 py-2">OO retained</th>
                <th className="px-2 py-2">Transfer</th>
                <th className="px-2 py-2">Vendor clawback</th>
              </tr>
            </thead>
            <tbody>
              {summary.vendorOrders.map((v) => (
                <tr key={v.id} className="border-b border-oo-light-stone/80 align-top">
                  <td className="px-2 py-2">
                    <span className="font-medium">{v.vendorName}</span>
                    {canExecuteRefunds && v.remainingRefundableCents > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="text-xs text-oo-stone-gray underline hover:text-oo-charcoal"
                          onClick={() =>
                            setModal({ kind: "full_vendor_order", vendorOrderId: v.id })
                          }
                        >
                          Refund vendor
                        </button>
                        <button
                          type="button"
                          className="text-xs text-oo-stone-gray underline hover:text-oo-charcoal"
                          onClick={() =>
                            setModal({ kind: "custom_vendor_partial", vendorOrderId: v.id })
                          }
                        >
                          Partial
                        </button>
                      </div>
                    )}
                    {v.lineItems.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-xs text-oo-stone-gray">
                        {v.lineItems.map((li) => (
                          <li key={li.id} className="flex flex-wrap items-center gap-1">
                            <span>
                              {li.name} × {li.quantity}
                            </span>
                            {canExecuteRefunds && v.remainingRefundableCents > 0 && (
                              <button
                                type="button"
                                className="underline hover:text-oo-charcoal"
                                onClick={() =>
                                  setModal({
                                    kind: "line_item_refund",
                                    vendorOrderId: v.id,
                                    orderLineItemId: li.id,
                                  })
                                }
                              >
                                Refund item
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">{v.fulfillmentStatus}</td>
                  <td className="px-2 py-2 tabular-nums">{formatAdminMoney(v.totalCents)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {formatAdminMoney(v.totalRefundedCents)}
                  </td>
                  <td className="px-2 py-2 tabular-nums font-medium">
                    {formatAdminMoney(v.remainingRefundableCents)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {v.grossVendorPayableCents != null
                      ? formatAdminMoney(v.grossVendorPayableCents)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {v.allocatedProcessingFeeCents != null
                      ? formatAdminMoney(v.allocatedProcessingFeeCents)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {v.netVendorTransferCents != null
                      ? formatAdminMoney(v.netVendorTransferCents)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 tabular-nums font-medium text-amber-900">
                    {formatAdminMoney(v.vendorStillOwedCents)}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {v.openOrderRetainedCents != null
                      ? formatAdminMoney(v.openOrderRetainedCents)
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <span className="rounded bg-oo-cream px-1.5 py-0.5 ring-1 ring-stone-200">
                      {adminVendorConnectTransferStatusLabel(v.transferStatus ?? "missing")}
                    </span>
                    {v.stripeTransferId && (
                      <p className="mt-0.5 font-mono text-[10px]">{shortenId(v.stripeTransferId)}</p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <div className="space-y-1.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${vendorClawbackStatusBadgeClass(v.clawback.clawbackStatus)}`}
                      >
                        {v.clawback.adminLabel}
                      </span>
                      {v.clawback.adminDetail ? (
                        <p className="text-[10px] leading-snug text-oo-stone-gray">{v.clawback.adminDetail}</p>
                      ) : null}
                      {v.clawback.clawbackRequiredCents > 0 ? (
                        <p className="text-[10px] tabular-nums text-oo-charcoal">
                          Required {formatAdminMoney(v.clawback.clawbackRequiredCents)}
                          {v.clawback.clawbackRecoveredCents > 0
                            ? ` · recovered ${formatAdminMoney(v.clawback.clawbackRecoveredCents)}`
                            : ""}
                        </p>
                      ) : null}
                      {v.clawback.adminWarning ? (
                        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[10px] text-red-950">
                          {v.clawback.adminWarning}
                        </p>
                      ) : null}
                      {(v.clawback.recommendedAction === "retry_reversal" ||
                        v.clawback.recommendedAction === "run_reversal_batch" ||
                        v.clawback.clawbackStatus === "pending") && (
                        <p className="text-[10px] leading-snug text-oo-stone-gray">
                          {v.reversals.some(
                            (r) => r.status === "pending" || r.status === "submitted"
                          )
                            ? "Prepared reversal pending. Run it from Vendor Transfers."
                            : v.clawback.recommendedAction === "retry_reversal"
                              ? "Retry the transfer reversal from Vendor Transfers."
                              : "Manage vendor clawback on Vendor Transfers."}
                        </p>
                      )}
                      {(v.clawback.recommendedAction === "retry_reversal" ||
                        v.clawback.recommendedAction === "run_reversal_batch" ||
                        v.clawback.clawbackStatus === "pending" ||
                        v.clawback.clawbackStatus === "failed") && (
                        <Link
                          href="/admin/payout-transfers"
                          className="inline-block text-[10px] font-semibold text-oo-charcoal underline"
                        >
                          Open Vendor Transfers
                        </Link>
                      )}
                      {v.reversalPrepare.canPrepare && v.vendorPayoutTransferId ? (
                        canExecuteRefunds ? (
                          <button
                            type="button"
                            disabled={prepareBusyId !== null}
                            onClick={() => void prepareMissingReversal(v.vendorPayoutTransferId!)}
                            className="inline-block rounded border border-oo-light-stone bg-oo-cream px-2 py-1 text-[10px] font-semibold text-oo-charcoal hover:bg-oo-warm-white disabled:opacity-50"
                          >
                            {prepareBusyId === v.vendorPayoutTransferId
                              ? "Preparing..."
                              : "Prepare vendor reversal"}
                          </button>
                        ) : (
                          <p className="text-[10px] text-oo-stone-gray">
                            Manual review required: platform-admin access is needed to prepare a reversal.
                          </p>
                        )
                      ) : v.reversalPrepare.blockReason ? (
                        <p className="text-[10px] leading-snug text-violet-950">
                          {formatPrepareMissingReversalError(v.reversalPrepare.blockReason)}
                        </p>
                      ) : null}
                      {v.vendorPayoutTransferId && v.legacyClawbackReview ? (
                        <LegacyClawbackReviewActions
                          vendorPayoutTransferId={v.vendorPayoutTransferId}
                          stripeTransferId={v.stripeTransferId}
                          needsReview={v.legacyClawbackReview.needsReview}
                          review={v.legacyClawbackReview}
                          onComplete={() => router.refresh()}
                        />
                      ) : null}
                      {v.clawback.clawbackStatus === "recovered" && v.reversals.some((r) => r.stripeTransferReversalId) ? (
                        <p className="text-[10px] leading-snug text-emerald-900">
                          Vendor clawback recovered via Stripe reversal{" "}
                          {shortenId(v.reversals.find((r) => r.stripeTransferReversalId)?.stripeTransferReversalId)}.
                          Open the original Stripe transfer {shortenId(v.stripeTransferId)} and check its Reversals section.
                        </p>
                      ) : v.stripeTransferId && v.clawback.clawbackStatus !== "not_needed" ? (
                        <p className="text-[10px] leading-snug text-oo-stone-gray">
                          To verify a successful clawback in Stripe, open the original Stripe transfer{" "}
                          {shortenId(v.stripeTransferId)} and check its Reversals section.
                        </p>
                      ) : null}
                      {v.clawback.clawbackStatus !== "not_needed" && v.reversals.length > 0 && (
                        <ul className="text-[10px] text-oo-stone-gray">
                          {v.reversals.map((rev) => (
                            <li key={rev.id}>
                              Reversal {rev.status} {formatAdminMoney(rev.amountCents)}
                              {rev.failureMessage ? ` — ${rev.failureMessage.slice(0, 80)}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                      {v.transferStatus === "cancelled_due_to_refund" && (
                        <p className="text-[10px] text-oo-stone-gray">
                          Vendor transfer cancelled due to refund — clawback not needed.
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="mt-6">
        <h3 className="text-sm font-medium text-oo-charcoal">Refund ledger</h3>
        <RefundsTable
          rows={summary.refundLedgerRows}
          inconsistentLedger={summary.refundDisplay.inconsistentLedger}
        />
      </div>

      {modal && (
        <RefundModal
          orderId={summary.order.id}
          kind={modal.kind}
          summary={summary}
          initialVendorOrderId={modal.vendorOrderId}
          initialOrderLineItemId={modal.orderLineItemId}
          linkedIssue={linkedIssue}
          onClose={() => {
            setModal(null);
            onRefundModalClosed?.();
          }}
        />
      )}
    </section>
  );
}
