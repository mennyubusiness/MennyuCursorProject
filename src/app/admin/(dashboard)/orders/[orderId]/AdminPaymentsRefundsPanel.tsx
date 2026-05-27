"use client";

import { useCallback, useMemo, useState } from "react";
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
} from "@/services/admin-order-payment-summary.service";
import type { AdminRefundPreviewPayload } from "@/lib/admin-refund-preview.types";

type ModalKind = AdminRefundScopeKey | null;

function shortenId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 20) return id;
  return `${id.slice(0, 14)}…${id.slice(-4)}`;
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

      {preview.blockingReasons.length > 0 && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-950">
          <p className="font-semibold">Cannot proceed</p>
          <ul className="mt-1 list-disc pl-4">
            {preview.blockingReasons.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RefundModal({
  orderId,
  kind,
  summary,
  initialVendorOrderId,
  onClose,
}: {
  orderId: string;
  kind: AdminRefundScopeKey;
  summary: AdminOrderPaymentSummary;
  initialVendorOrderId?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [customerVisibleNote, setCustomerVisibleNote] = useState("");
  const [vendorOrderId, setVendorOrderId] = useState(initialVendorOrderId ?? summary.vendorOrders[0]?.id ?? "");
  const [amountDollars, setAmountDollars] = useState("");
  const [platformAbsorbsRefund, setPlatformAbsorbsRefund] = useState(false);
  const [preview, setPreview] = useState<AdminRefundPreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);
  const [executeSuccess, setExecuteSuccess] = useState<string | null>(null);

  const selectedVo = summary.vendorOrders.find((v) => v.id === vendorOrderId);

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
    if (kind !== "full_order") {
      body.vendorOrderId = vendorOrderId;
    }
    if (kind === "custom_vendor_partial") {
      body.amountCents = amountCents;
      body.platformAbsorbsRefund = platformAbsorbsRefund;
    }
    return body;
  }, [kind, reason, adminNote, customerVisibleNote, vendorOrderId, amountCents, platformAbsorbsRefund]);

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
        setExecuteError(
          data.message ?? data.error ?? `Refund failed (${res.status})`
        );
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
                }
          );
        }
        return;
      }
      const reversalNote =
        data.transferReversal?.outcome === "created_pending"
          ? " Vendor transfer reversal rows were prepared — execute reversals from the payout reversal workflow."
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
        amountCents > 0));

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
              disabled={Boolean(initialVendorOrderId)}
            >
              {summary.vendorOrders.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendorName} — {formatAdminMoney(v.remainingRefundableCents)} remaining
                </option>
              ))}
            </select>
          </label>
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
            {kind === "custom_vendor_partial" || platformAbsorbsRefund
              ? " (required)"
              : " (optional)"}
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

function RefundsTable({ rows }: { rows: AdminOrderPaymentSummaryRefund[] }) {
  if (rows.length === 0) {
    return <p className="mt-2 text-sm text-oo-stone-gray">No refunds recorded yet.</p>;
  }
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-oo-light-stone text-xs uppercase tracking-wide text-oo-stone-gray">
            <th className="px-2 py-2">Date</th>
            <th className="px-2 py-2">Scope</th>
            <th className="px-2 py-2">Vendor</th>
            <th className="px-2 py-2">Amount</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Initiated</th>
            <th className="px-2 py-2">Stripe</th>
            <th className="px-2 py-2">Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-oo-light-stone/80">
              <td className="px-2 py-2 text-xs text-oo-stone-gray">
                {new Date(r.createdAt).toLocaleString()}
              </td>
              <td className="px-2 py-2">{refundScopeLabel(r.refundScope)}</td>
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
                {r.failureMessage && (
                  <p className="mt-0.5 text-xs text-red-700">{r.failureMessage.slice(0, 80)}</p>
                )}
              </td>
              <td className="px-2 py-2 text-xs">{r.initiatedByRole}</td>
              <td className="px-2 py-2 font-mono text-xs">{shortenId(r.stripeRefundId)}</td>
              <td className="px-2 py-2 text-xs">
                {r.adminNote ? (
                  <span title={r.adminNote}>Admin note</span>
                ) : (
                  "—"
                )}
                {r.refundAttemptStatus && (
                  <span className="block text-oo-stone-gray">
                    Attempt: {r.refundAttemptStatus}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPaymentsRefundsPanel({
  summary,
  canExecuteRefunds,
}: {
  summary: AdminOrderPaymentSummary;
  canExecuteRefunds: boolean;
}) {
  const [modal, setModal] = useState<{
    kind: AdminRefundScopeKey;
    vendorOrderId?: string;
  } | null>(null);

  const payment = summary.payment;
  const hasRemaining = summary.order.remainingRefundableCents > 0;

  const pendingReversalCount = summary.vendorOrders.reduce(
    (n, v) => n + v.reversals.filter((r) => r.status === "pending" || r.status === "submitted").length,
    0
  );

  return (
    <section
      id="payments-refunds"
      className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-4 scroll-mt-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-oo-charcoal">Payments &amp; Refunds</h2>
          <p className="mt-1 text-sm text-oo-stone-gray">
            Customer refunds debit the platform PaymentIntent. Vendor clawback uses a separate{" "}
            <Link href="/admin/payout-transfers" className="font-medium text-oo-charcoal underline">
              payout reversals workflow
            </Link>
            .
          </p>
          {pendingReversalCount > 0 && (
            <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              {pendingReversalCount} transfer reversal row(s) need manual execution — prepared rows
              are not completed until processed in payout reversals.
            </p>
          )}
        </div>
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

      {/* Order payment summary */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Order payment
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Customer paid</dt>
              <dd className="font-medium tabular-nums">
                {formatAdminMoney(payment?.amountCents ?? summary.order.totalCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Total refunded</dt>
              <dd className="tabular-nums">{formatAdminMoney(summary.order.totalRefundedCents)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Remaining refundable</dt>
              <dd className="font-semibold tabular-nums text-oo-charcoal">
                {formatAdminMoney(summary.order.remainingRefundableCents)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Refund status</dt>
              <dd>{paymentRefundStatusLabel(summary.order.paymentRefundStatus)}</dd>
            </div>
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
          </dl>
        </div>
        <div className="rounded-lg border border-oo-light-stone bg-oo-cream/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-oo-stone-gray">
            Stripe
          </h3>
          <dl className="mt-2 space-y-1 text-sm">
            <div>
              <dt className="text-oo-stone-gray">PaymentIntent</dt>
              <dd className="break-all font-mono text-xs">
                {payment?.stripePaymentIntentId ?? summary.order.stripePaymentIntentId ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Charge</dt>
              <dd className="break-all font-mono text-xs">
                {payment?.stripeChargeId ?? (
                  <span className="text-amber-800">
                    Charge ID missing for this payment. Historical payment may need reconciliation
                    before some refund operations.
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-oo-stone-gray">Balance transaction</dt>
              <dd className="break-all font-mono text-xs">
                {payment?.stripeBalanceTransactionId ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-oo-stone-gray">Processing fee</dt>
              <dd className="tabular-nums">
                {payment?.stripeProcessingFeeCents != null
                  ? formatAdminMoney(payment.stripeProcessingFeeCents)
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Vendor breakdown */}
      <div className="mt-6">
        <h3 className="font-medium text-oo-charcoal">Vendor payout breakdown</h3>
        <p className="text-xs text-oo-stone-gray">
          PaymentAllocation is the source of truth for net vendor transfer amounts.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-oo-light-stone text-xs uppercase tracking-wide text-oo-stone-gray">
                <th className="px-2 py-2">Vendor</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Customer total</th>
                <th className="px-2 py-2">Refunded</th>
                <th className="px-2 py-2">Remaining</th>
                <th className="px-2 py-2">Gross payable</th>
                <th className="px-2 py-2">Stripe fee alloc.</th>
                <th className="px-2 py-2">Net transfer</th>
                <th className="px-2 py-2">Transfer</th>
                <th className="px-2 py-2">Reversal</th>
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
                  <td className="px-2 py-2 text-xs">
                    <span className="rounded bg-oo-cream px-1.5 py-0.5 ring-1 ring-stone-200">
                      {v.transferStatus ?? "missing"}
                    </span>
                    {v.stripeTransferId && (
                      <p className="mt-0.5 font-mono text-[10px]">{shortenId(v.stripeTransferId)}</p>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <p
                      className={`rounded border px-2 py-1 text-xs ${transferToneClass(v.transferMessage.tone)}`}
                    >
                      {v.transferMessage.message}
                    </p>
                    {v.reversals.length > 0 && (
                      <ul className="mt-1 text-[10px] text-oo-stone-gray">
                        {v.reversals.map((rev) => (
                          <li key={rev.id}>
                            Reversal {rev.status} {formatAdminMoney(rev.amountCents)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refunds ledger */}
      <div className="mt-6">
        <h3 className="font-medium text-oo-charcoal">Refund ledger</h3>
        <RefundsTable rows={summary.orderRefunds} />
      </div>

      {modal && (
        <RefundModal
          orderId={summary.order.id}
          kind={modal.kind}
          summary={summary}
          initialVendorOrderId={modal.vendorOrderId}
          onClose={() => setModal(null)}
        />
      )}
    </section>
  );
}
