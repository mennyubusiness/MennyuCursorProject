"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminFetchStripePlatformBalanceAction,
  adminReconcileEligibleVendorPayoutTransfersAction,
  adminReconcileVendorPayoutTransferAction,
  adminRetryAllEligibleVendorPayoutTransfersAction,
  adminRetryVendorPayoutTransferAction,
  adminRetryVendorPayoutTransferWithNewKeyAction,
  adminRunVendorPayoutTransferBatchAction,
} from "@/actions/admin-payout-transfer.actions";
import {
  adminRetryTransferReversalAction,
  adminRunTransferReversalBatchAction,
} from "@/actions/admin-payout-transfer-reversal.actions";
import {
  displayPayoutTransferFailure,
  IDEMPOTENCY_MISMATCH_STATUS,
  INSUFFICIENT_BALANCE_STATUS,
  isInsufficientBalanceTransfer,
  isIdempotencyMismatchTransfer,
  isRetryablePayoutTransfer,
  canRetryWithNewIdempotencyKey,
} from "@/lib/vendor-payout-transfer-failure";
import {
  isReconcilablePayoutTransfer,
} from "@/lib/vendor-payout-transfer-reconciliation";
import {
  computeVendorLiabilityTotals,
  adminVendorConnectTransferStatusLabel,
  STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT,
  VENDOR_PAID_VIA_CONNECT_LABEL,
} from "@/lib/stripe-money-movement";
import { StripeMoneyMovementBreakdown } from "@/components/admin/StripeMoneyMovementBreakdown";
import type { StripePlatformBalanceSnapshot } from "@/services/stripe-balance.service";

import type {
  AdminPayoutTransferRow,
  AdminTransferReversalRow,
  AdminVendorOption,
} from "./payout-transfers-admin.types";

type DatePreset = "all" | "today" | "7d";

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    cents / 100
  );
}

function shortenDestination(id: string): string {
  const t = id.trim();
  if (t === "blocked") return "blocked";
  if (t.startsWith("acct_") && t.length > 14) return `${t.slice(0, 10)}…${t.slice(-4)}`;
  if (t.length > 18) return `${t.slice(0, 10)}…${t.slice(-4)}`;
  return t;
}

function shortenStripeId(id: string | null | undefined): string {
  if (!id) return "—";
  if (id.length <= 16) return id;
  return `${id.slice(0, 10)}…${id.slice(-4)}`;
}

function statusFilterBucket(status: string): "pending" | "paid" | "failed" | "blocked" {
  if (status === INSUFFICIENT_BALANCE_STATUS) return "blocked";
  if (status === IDEMPOTENCY_MISMATCH_STATUS) return "blocked";
  if (status === "blocked") return "blocked";
  if (status === "failed") return "failed";
  if (status === "paid") return "paid";
  if (status === "pending" || status === "submitted") return "pending";
  return "pending";
}

function statusLabel(status: string): string {
  return adminVendorConnectTransferStatusLabel(status);
}

function statusBadgeClass(status: string): string {
  if (status === INSUFFICIENT_BALANCE_STATUS || status === IDEMPOTENCY_MISMATCH_STATUS) {
    return "bg-orange-100 text-orange-950 ring-orange-200";
  }
  const b = statusFilterBucket(status);
  if (b === "paid") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (b === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (b === "blocked") return "bg-amber-100 text-amber-950 ring-amber-200";
  return "bg-oo-cream text-oo-charcoal ring-stone-200";
}

/** Reversal statuses: pending | submitted | reversed | failed | not_needed */
function reversalStatusBadgeClass(status: string): string {
  if (status === "reversed") return "bg-emerald-100 text-emerald-900 ring-emerald-200";
  if (status === "failed") return "bg-red-100 text-red-900 ring-red-200";
  if (status === "not_needed") return "bg-oo-cream text-oo-stone-gray ring-stone-200";
  return "bg-oo-cream text-oo-charcoal ring-stone-200";
}

function reversalMatchesPayoutStatusFilter(
  status: string,
  filter: string
): boolean {
  if (filter === "all") return true;
  if (filter === "failed") return status === "failed";
  if (filter === "paid") return status === "reversed";
  if (filter === "blocked") return false;
  if (filter === "pending") return status === "pending" || status === "submitted";
  return status === filter;
}

function normalizeTransferRow(t: AdminPayoutTransferRow): AdminPayoutTransferRow {
  return {
    ...t,
    createdAt: typeof t.createdAt === "string" ? t.createdAt : new Date(t.createdAt as unknown as Date).toISOString(),
    submittedAt:
      t.submittedAt == null
        ? null
        : typeof t.submittedAt === "string"
          ? t.submittedAt
          : new Date(t.submittedAt as unknown as Date).toISOString(),
    failedAt:
      t.failedAt == null
        ? null
        : typeof t.failedAt === "string"
          ? t.failedAt
          : new Date(t.failedAt as unknown as Date).toISOString(),
  };
}

function normalizeReversalRow(r: AdminTransferReversalRow): AdminTransferReversalRow {
  return {
    ...r,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt as unknown as Date).toISOString(),
    submittedAt:
      r.submittedAt == null
        ? null
        : typeof r.submittedAt === "string"
          ? r.submittedAt
          : new Date(r.submittedAt as unknown as Date).toISOString(),
    failedAt:
      r.failedAt == null
        ? null
        : typeof r.failedAt === "string"
          ? r.failedAt
          : new Date(r.failedAt as unknown as Date).toISOString(),
  };
}

function datePresetStart(preset: DatePreset): Date | null {
  if (preset === "all") return null;
  const now = new Date();
  if (preset === "today") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function inDateRange(iso: string, preset: DatePreset): boolean {
  const start = datePresetStart(preset);
  if (!start) return true;
  return new Date(iso).getTime() >= start.getTime();
}

function FailureText({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return null;
  const t = text.trim();
  const short = t.length > 140;
  const shown = short && !open ? `${t.slice(0, 140)}…` : t;
  return (
    <div className="mt-1 max-w-xs">
      <p className="whitespace-pre-wrap break-words font-mono text-[10px] leading-snug text-oo-stone-gray">
        Stripe detail: {shown}
      </p>
      {short && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-0.5 text-[10px] font-semibold text-oo-charcoal hover:underline"
        >
          {open ? "Hide Stripe detail" : "Show Stripe detail"}
        </button>
      )}
    </div>
  );
}

function ReversalFailureText({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text?.trim()) return <span className="text-oo-stone-gray">—</span>;
  const t = text.trim();
  const short = t.length > 140;
  const shown = short && !open ? `${t.slice(0, 140)}…` : t;
  return (
    <div className="max-w-xs">
      <p className="whitespace-pre-wrap break-words font-mono text-[11px] leading-snug text-oo-charcoal">{shown}</p>
      {short && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-semibold text-oo-charcoal hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function PayoutFailureCell({
  row,
}: {
  row: Pick<AdminPayoutTransferRow, "status" | "blockedReason" | "failureMessage">;
}) {
  if (row.status === "blocked" && row.blockedReason) {
    return (
      <div>
        <span className="font-mono text-xs">{row.blockedReason}</span>
      </div>
    );
  }
  const failure = displayPayoutTransferFailure(row);
  if (failure.primary === "—") {
    return <span className="text-oo-stone-gray">—</span>;
  }
  return (
    <div>
      <p className="text-xs font-medium text-oo-charcoal">{failure.primary}</p>
      {failure.detail ? <p className="mt-0.5 text-[11px] text-oo-stone-gray">{failure.detail}</p> : null}
      {failure.raw ? <FailureText text={failure.raw} /> : null}
    </div>
  );
}

function groupTransferKey(row: AdminPayoutTransferRow): string {
  const bk = row.batchKey?.trim();
  if (bk) return `batch:${bk}`;
  return `day:${row.createdAt.slice(0, 10)}`;
}

function groupReversalKey(row: AdminTransferReversalRow): string {
  const bk = row.batchKey?.trim();
  if (bk) return `batch:${bk}`;
  return `day:${row.createdAt.slice(0, 10)}`;
}

export function PayoutTransfersDashboard({
  initialTransfers,
  initialReversals,
  vendors,
  initialBalance,
  initialBalanceError,
}: {
  initialTransfers: AdminPayoutTransferRow[];
  initialReversals: AdminTransferReversalRow[];
  vendors: AdminVendorOption[];
  initialBalance: StripePlatformBalanceSnapshot | null;
  initialBalanceError: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [transfers, setTransfers] = useState(initialTransfers);
  const [reversals, setReversals] = useState(initialReversals);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vendorId, setVendorId] = useState<string>("");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedRevGroups, setExpandedRevGroups] = useState<Record<string, boolean>>({});

  const [batchKey, setBatchKey] = useState("");
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [batchErr, setBatchErr] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState<"payout" | "retry_all" | "reconcile" | "reversal" | null>(null);
  const [vendorSearch, setVendorSearch] = useState("");
  const [retryPayoutId, setRetryPayoutId] = useState<string | null>(null);
  const [reconcilePayoutId, setReconcilePayoutId] = useState<string | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState<Record<string, string>>({});
  const [reconcileOutcomes, setReconcileOutcomes] = useState<Record<string, string>>({});
  const [newKeyRetryId, setNewKeyRetryId] = useState<string | null>(null);
  const [retryReversalId, setRetryReversalId] = useState<string | null>(null);
  const [balance, setBalance] = useState<StripePlatformBalanceSnapshot | null>(initialBalance);
  const [balanceError, setBalanceError] = useState<string | null>(initialBalanceError);
  const [balanceBusy, setBalanceBusy] = useState(false);

  useEffect(() => {
    setTransfers(initialTransfers);
    setReversals(initialReversals);
    setBalance(initialBalance);
    setBalanceError(initialBalanceError);
  }, [initialTransfers, initialReversals, initialBalance, initialBalanceError]);

  const vendorsFiltered = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) => v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q));
  }, [vendors, vendorSearch]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (!inDateRange(t.createdAt, datePreset)) return false;
      if (vendorId && t.vendorId !== vendorId) return false;
      if (statusFilter !== "all" && statusFilterBucket(t.status) !== statusFilter) return false;
      return true;
    });
  }, [transfers, datePreset, vendorId, statusFilter]);

  const filteredReversals = useMemo(() => {
    return reversals.filter((r) => {
      if (!inDateRange(r.createdAt, datePreset)) return false;
      if (vendorId && r.vendorId !== vendorId) return false;
      if (!reversalMatchesPayoutStatusFilter(r.status, statusFilter)) return false;
      return true;
    });
  }, [reversals, datePreset, vendorId, statusFilter]);

  const liabilityTotals = useMemo(() => computeVendorLiabilityTotals(transfers), [transfers]);

  const summary = useMemo(() => {
    let pendingCents = 0;
    let paidCents = 0;
    let failed = 0;
    let blockedConnect = 0;
    let blockedInsufficientCents = 0;
    let retryableFailedCents = 0;
    for (const t of filteredTransfers) {
      const bucket = statusFilterBucket(t.status);
      if (bucket === "pending") pendingCents += t.amountCents;
      if (bucket === "paid") paidCents += t.amountCents;
      if (bucket === "failed") {
        failed++;
        if (isRetryablePayoutTransfer(t)) retryableFailedCents += t.amountCents;
      }
      if (bucket === "blocked") {
        if (isInsufficientBalanceTransfer(t)) {
          blockedInsufficientCents += t.amountCents;
        } else {
          blockedConnect++;
        }
      }
    }
    return {
      pendingCents,
      paidCents,
      failed,
      blockedConnect,
      blockedInsufficientCents,
      retryableFailedCents,
    };
  }, [filteredTransfers]);

  const transferGroups = useMemo(() => {
    const map = new Map<string, AdminPayoutTransferRow[]>();
    for (const t of filteredTransfers) {
      const k = groupTransferKey(t);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    const entries = [...map.entries()].sort((a, b) => {
      const ta = Math.max(...a[1].map((x) => new Date(x.createdAt).getTime()));
      const tb = Math.max(...b[1].map((x) => new Date(x.createdAt).getTime()));
      return tb - ta;
    });
    return entries;
  }, [filteredTransfers]);

  const reversalGroups = useMemo(() => {
    const map = new Map<string, AdminTransferReversalRow[]>();
    for (const r of filteredReversals) {
      const k = groupReversalKey(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return [...map.entries()].sort((a, b) => {
      const ta = Math.max(...a[1].map((x) => new Date(x.createdAt).getTime()));
      const tb = Math.max(...b[1].map((x) => new Date(x.createdAt).getTime()));
      return tb - ta;
    });
  }, [filteredReversals]);

  function groupTitle(key: string): string {
    if (key.startsWith("batch:")) return `Batch ${key.slice("batch:".length)}`;
    return `Date ${key.slice("day:".length)}`;
  }

  function isGroupOpen(key: string, map: Record<string, boolean>) {
    return map[key] !== false;
  }

  function toggleGroup(key: string, setMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) {
    setMap((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  }

  async function runPayoutBatch() {
    setBatchBusy("payout");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminRunVendorPayoutTransferBatchAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setBatchErr(
          "balanceError" in r && r.balanceError ? `${r.error} (${r.balanceError})` : r.error
        );
        return;
      }
      setBatchMsg(
        `Vendor transfer batch: examined ${r.summary.examined}, settled ${r.summary.settled}, skipped ${r.summary.skipped}, failed ${r.summary.failed}, blocked (balance) ${r.summary.blockedInsufficientBalance}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function runRetryAllPayouts() {
    setBatchBusy("retry_all");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminRetryAllEligibleVendorPayoutTransfersAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setBatchErr(
          "balanceError" in r && r.balanceError ? `${r.error} (${r.balanceError})` : r.error
        );
        return;
      }
      setBatchMsg(
        `Retry all vendor transfers: examined ${r.summary.examined}, settled ${r.summary.settled}, skipped ${r.summary.skipped}, failed ${r.summary.failed}, blocked (balance) ${r.summary.blockedInsufficientBalance}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Retry all failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function refreshBalance() {
    setBalanceBusy(true);
    setBalanceError(null);
    try {
      const r = await adminFetchStripePlatformBalanceAction();
      if (!r.ok) {
        setBalanceError(r.error);
        setBalance(null);
        return;
      }
      setBalance(r.balance);
    } catch (e) {
      setBalanceError(e instanceof Error ? e.message : "Unable to fetch Stripe balance");
      setBalance(null);
    } finally {
      setBalanceBusy(false);
    }
  }

  async function runReversalBatch() {
    setBatchBusy("reversal");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminRunTransferReversalBatchAction(batchKey.trim() || undefined);
      if (!r.ok) {
        setBatchErr(r.error);
        return;
      }
      setBatchMsg(
        `Reversal batch: examined ${r.summary.examined}, reversed ${r.summary.reversed}, skipped ${r.summary.skipped}, failed ${r.summary.failed}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Batch failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function runBulkReconcile() {
    setBatchBusy("reconcile");
    setBatchErr(null);
    setBatchMsg(null);
    try {
      const r = await adminReconcileEligibleVendorPayoutTransfersAction(50);
      if (!r.ok) {
        setBatchErr(r.error);
        return;
      }
      setBatchMsg(
        `Reconcile with Stripe: checked ${r.summary.checked}, updated paid ${r.summary.updatedPaid}, not found ${r.summary.notFound}, ambiguous ${r.summary.ambiguous}, mismatched ${r.summary.mismatched}, errors ${r.summary.errors}.`
      );
      startTransition(() => router.refresh());
    } catch (e) {
      setBatchErr(e instanceof Error ? e.message : "Reconciliation failed");
    } finally {
      setBatchBusy(null);
    }
  }

  async function checkStripeTransfer(id: string) {
    setReconcilePayoutId(id);
    try {
      const r = await adminReconcileVendorPayoutTransferAction(id);
      if (!r.ok) {
        setReconcileNotes((prev) => ({ ...prev, [id]: r.error }));
        return;
      }
      const msg = r.result.message;
      setReconcileOutcomes((prev) => ({ ...prev, [id]: r.result.outcome }));
      setReconcileNotes((prev) => ({
        ...prev,
        [id]:
          r.result.detail && r.result.outcome !== "updated_paid"
            ? `${msg} (${r.result.detail})`
            : msg,
      }));
      if (
        (r.result.outcome === "updated_paid" || r.result.outcome === "already_paid") &&
        r.transfer
      ) {
        setTransfers((prev) =>
          prev.map((t) => (t.id === id ? normalizeTransferRow(r.transfer!) : t))
        );
        startTransition(() => router.refresh());
      }
    } finally {
      setReconcilePayoutId(null);
    }
  }

  async function retryWithNewTransferKey(id: string) {
    const confirmed = window.confirm(
      "Only use this if no matching Stripe Connect transfer exists. This will attempt a new vendor transfer with a new idempotency key."
    );
    if (!confirmed) return;
    setNewKeyRetryId(id);
    try {
      const r = await adminRetryVendorPayoutTransferWithNewKeyAction(id);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      if (
        (r.result.outcome === "reconciled_paid" || r.result.outcome === "paid") &&
        r.transfer
      ) {
        setTransfers((prev) =>
          prev.map((t) => (t.id === id ? normalizeTransferRow(r.transfer!) : t))
        );
        startTransition(() => router.refresh());
      }
    } finally {
      setNewKeyRetryId(null);
    }
  }

  async function retryTransfer(id: string) {
    setRetryPayoutId(id);
    try {
      const r = await adminRetryVendorPayoutTransferAction(id);
      if (!r.ok) {
        alert(r.error);
        return;
      }
      if (!r.transfer) {
        alert("Retry failed");
        return;
      }
      const row = normalizeTransferRow(r.transfer);
      setTransfers((prev) => prev.map((t) => (t.id === id ? row : t)));
      startTransition(() => router.refresh());
    } finally {
      setRetryPayoutId(null);
    }
  }

  async function retryReversal(id: string) {
    setRetryReversalId(id);
    try {
      const r = await adminRetryTransferReversalAction(id);
      if (!r.ok || !r.reversal) {
        alert(r.ok === false ? r.error : "Retry failed");
        return;
      }
      const row = normalizeReversalRow(r.reversal);
      setReversals((prev) => prev.map((x) => (x.id === id ? row : x)));
    } finally {
      setRetryReversalId(null);
    }
  }

  const actionLocked =
    batchBusy !== null ||
    retryPayoutId !== null ||
    retryReversalId !== null ||
    reconcilePayoutId !== null ||
    newKeyRetryId !== null;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-oo-light-stone bg-oo-cream p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-oo-charcoal">Stripe platform balance</h2>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-oo-stone-gray">
              Vendor transfers can only be sent from Stripe available balance. Pending customer payments and funds
              already paid out to the platform bank cannot fund Connect transfers until available in Stripe.
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-oo-stone-gray">
              Automatic platform payouts are currently expected to run weekly. If vendor transfers are blocked, wait for
              pending funds to become available or add funds, then retry.
            </p>
          </div>
          <button
            type="button"
            disabled={balanceBusy || actionLocked}
            onClick={() => void refreshBalance()}
            className="shrink-0 rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-1.5 text-xs font-semibold text-oo-charcoal hover:bg-white disabled:opacity-50"
          >
            {balanceBusy ? "Refreshing…" : "Refresh Stripe balance"}
          </button>
        </div>
        {balanceError ? (
          <p className="mt-3 text-sm text-amber-900" role="status">
            Unable to fetch Stripe balance: {balanceError}
          </p>
        ) : balance ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Available</p>
              <p className="mt-1 text-lg font-semibold text-emerald-900">
                {formatMoney(balance.availableCents, balance.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Pending</p>
              <p className="mt-1 text-lg font-semibold text-oo-charcoal">
                {formatMoney(balance.pendingCents, balance.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Retryable vendor transfers (filtered)</p>
              <p className="mt-1 text-lg font-semibold text-red-800">
                {formatMoney(summary.retryableFailedCents + summary.blockedInsufficientCents, "usd")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">As of</p>
              <p className="mt-1 font-mono text-xs text-oo-stone-gray">
                {balance.retrievedAt.slice(0, 19).replace("T", " ")}Z
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-oo-stone-gray">Stripe balance unavailable.</p>
        )}
      </div>

      <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-oo-charcoal">Vendor liability summary</h2>
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-oo-stone-gray">
          {STRIPE_PLATFORM_PAYOUT_NOT_VENDOR_PAYMENT} Money paid out to the Open Order bank may still include vendor
          liabilities below until Connect transfers succeed.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Vendor still owed</p>
            <p className="mt-1 text-lg font-semibold text-amber-900">
              {formatMoney(liabilityTotals.vendorOwedCents, "usd")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Vendor paid via Connect</p>
            <p className="mt-1 text-lg font-semibold text-emerald-900">
              {formatMoney(liabilityTotals.vendorPaidCents, "usd")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">
              Blocked vendor transfers: insufficient balance
            </p>
            <p className="mt-1 text-lg font-semibold text-orange-900">
              {formatMoney(liabilityTotals.blockedInsufficientBalanceCents, "usd")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Connect-blocked vendors</p>
            <p className="mt-1 text-lg font-semibold text-oo-charcoal">{liabilityTotals.blockedConnectCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runPayoutBatch()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-hover disabled:opacity-50"
            >
              {batchBusy === "payout" ? "Running…" : "Run vendor transfer batch"}
            </button>
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runRetryAllPayouts()}
              className="rounded-lg border border-orange-300 bg-orange-50 px-4 py-2 text-sm font-semibold text-orange-950 shadow-sm hover:bg-orange-100 disabled:opacity-50"
            >
              {batchBusy === "retry_all" ? "Retrying…" : "Retry all eligible vendor transfers"}
            </button>
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runBulkReconcile()}
              className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-950 shadow-sm hover:bg-sky-100 disabled:opacity-50"
            >
              {batchBusy === "reconcile" ? "Reconciling…" : "Reconcile with Stripe"}
            </button>
            <button
              type="button"
              disabled={actionLocked}
              onClick={() => void runReversalBatch()}
              className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-4 py-2 text-sm font-semibold text-oo-charcoal shadow-sm hover:bg-oo-cream disabled:opacity-50"
            >
              {batchBusy === "reversal" ? "Running…" : "Run reversal batch"}
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium text-oo-stone-gray">
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
              >
                <option value="all">All</option>
                <option value="pending">Pending / submitted</option>
                <option value="paid">{VENDOR_PAID_VIA_CONNECT_LABEL}</option>
                <option value="failed">Failed</option>
                <option value="blocked">Blocked</option>
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1 text-xs font-medium text-oo-stone-gray">
              Vendor
              <input
                type="search"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Filter list…"
                className="mb-1 rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-1 text-sm text-oo-charcoal"
              />
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
              >
                <option value="">All vendors</option>
                {vendorsFiltered.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-oo-stone-gray">
              Date range
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value as DatePreset)}
                className="rounded-lg border border-oo-light-stone bg-oo-warm-white px-2 py-1.5 text-sm text-oo-charcoal"
              >
                <option value="all">All</option>
                <option value="today">Today (UTC)</option>
                <option value="7d">Last 7 days</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-oo-stone-gray">
              Batch key (optional)
              <input
                type="text"
                value={batchKey}
                onChange={(e) => setBatchKey(e.target.value)}
                placeholder="UTC date or label"
                className="w-40 rounded-lg border border-oo-light-stone px-2 py-1.5 font-mono text-xs text-oo-charcoal"
              />
            </label>
          </div>
        </div>
        {batchErr && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {batchErr}
          </p>
        )}
        {batchMsg && <p className="mt-3 text-sm text-emerald-800">{batchMsg}</p>}
      </div>

      <div className="grid gap-3 rounded-xl border border-oo-light-stone bg-oo-cream p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Pending (filtered)</p>
          <p className="mt-1 text-lg font-semibold text-oo-charcoal">{formatMoney(summary.pendingCents, "usd")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Paid (filtered)</p>
          <p className="mt-1 text-lg font-semibold text-emerald-900">{formatMoney(summary.paidCents, "usd")}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Failed rows</p>
          <p className="mt-1 text-lg font-semibold text-red-800">{summary.failed}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Blocked (Connect)</p>
          <p className="mt-1 text-lg font-semibold text-amber-900">{summary.blockedConnect}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-oo-stone-gray">Blocked (balance)</p>
          <p className="mt-1 text-lg font-semibold text-orange-900">
            {formatMoney(summary.blockedInsufficientCents, "usd")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Vendor Connect transfers</h2>
        <p className="text-sm text-oo-stone-gray">
          Execution rows for Open Order → vendor connected account transfers. Retries use stable Stripe idempotency keys
          and check platform available balance before calling Stripe.
        </p>
        {transferGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-oo-light-stone bg-oo-warm-white p-8 text-center text-oo-stone-gray">
            No transfers match filters.
          </p>
        ) : (
          transferGroups.map(([gKey, rows]) => {
            const open = isGroupOpen(gKey, expandedGroups);
            const total = rows.reduce((s, r) => s + r.amountCents, 0);
            return (
              <div key={gKey} className="overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleGroup(gKey, setExpandedGroups)}
                  className="flex w-full items-center justify-between gap-3 border-b border-oo-light-stone bg-oo-cream px-4 py-3 text-left text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
                >
                  <span>{groupTitle(gKey)}</span>
                  <span className="text-xs font-normal text-oo-stone-gray">
                    {rows.length} transfer{rows.length !== 1 ? "s" : ""} · {formatMoney(total, rows[0]?.currency ?? "usd")}
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-oo-light-stone bg-oo-warm-white text-xs font-medium uppercase text-oo-stone-gray">
                        <tr>
                          <th className="px-3 py-2">Vendor</th>
                          <th className="px-3 py-2">Order</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Reason</th>
                          <th className="px-3 py-2">Destination</th>
                          <th className="px-3 py-2">Created / submitted</th>
                          <th className="px-3 py-2">Stripe transfer</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-oo-light-stone">
                        {rows.map((t) => {
                          const bucket = statusFilterBucket(t.status);
                          const insufficient = isInsufficientBalanceTransfer(t);
                          const idempotencyMismatch = isIdempotencyMismatchTransfer(t);
                          const retryable = isRetryablePayoutTransfer(t);
                          const reconcilable = isReconcilablePayoutTransfer(t);
                          const newKeyRetry = canRetryWithNewIdempotencyKey(t, reconcileOutcomes[t.id]);
                          const rowTint = insufficient || idempotencyMismatch
                            ? "bg-orange-50/50"
                            : bucket === "failed"
                              ? "bg-red-50/50"
                              : bucket === "blocked"
                                ? "bg-amber-50/40"
                                : "";
                          return (
                            <>
                            <tr key={t.id} className={rowTint}>
                              <td className="px-3 py-2 font-medium text-oo-charcoal">{t.vendor.name}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/admin/orders/${t.vendorOrder.orderId}`}
                                  className="font-mono text-xs text-oo-charcoal hover:underline"
                                >
                                  {t.vendorOrder.orderId.slice(-10)}
                                </Link>
                              </td>
                              <td className="px-3 py-2 tabular-nums">
                                <div>{formatMoney(t.amountCents, t.currency)}</div>
                                {t.moneyMovement && t.moneyMovement.vendorStillOwedCents > 0 && (
                                  <div className="text-[10px] font-medium text-amber-900">
                                    owed {formatMoney(t.moneyMovement.vendorStillOwedCents, t.currency)}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(t.status)}`}
                                >
                                  {statusLabel(t.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-oo-charcoal">
                                <PayoutFailureCell row={t} />
                                {t.status === "blocked" && !insufficient && (
                                  <div className="mt-1">
                                    <Link
                                      href={`/admin/vendors/${t.vendorId}`}
                                      className="text-xs font-semibold text-oo-charcoal hover:underline"
                                    >
                                      View vendor
                                    </Link>
                                  </div>
                                )}
                              </td>
                              <td className="max-w-[140px] truncate px-3 py-2 font-mono text-xs" title={t.destinationAccountId}>
                                {shortenDestination(t.destinationAccountId)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-oo-stone-gray">
                                <div>{t.createdAt.slice(0, 19).replace("T", " ")}Z</div>
                                {t.submittedAt && (
                                  <div className="text-oo-stone-gray">sub: {t.submittedAt.slice(0, 19).replace("T", " ")}Z</div>
                                )}
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={t.stripeTransferId ?? ""}>
                                {shortenStripeId(t.stripeTransferId)}
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex flex-col gap-1">
                                  {reconcilable ? (
                                    <button
                                      type="button"
                                      disabled={reconcilePayoutId !== null || retryPayoutId !== null}
                                      onClick={() => void checkStripeTransfer(t.id)}
                                      className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-50"
                                    >
                                      {reconcilePayoutId === t.id ? "Checking…" : "Check Stripe"}
                                    </button>
                                  ) : null}
                                  {retryable ? (
                                    <button
                                      type="button"
                                      disabled={retryPayoutId !== null || reconcilePayoutId !== null}
                                      onClick={() => void retryTransfer(t.id)}
                                      className="rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                                    >
                                      {retryPayoutId === t.id ? "Retrying…" : "Retry vendor transfer"}
                                    </button>
                                  ) : null}
                                  {newKeyRetry ? (
                                    <button
                                      type="button"
                                      disabled={newKeyRetryId !== null || reconcilePayoutId !== null}
                                      onClick={() => void retryWithNewTransferKey(t.id)}
                                      className="rounded-md border border-violet-300 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-950 hover:bg-violet-100 disabled:opacity-50"
                                    >
                                      {newKeyRetryId === t.id ? "Retrying…" : "Retry with new transfer key"}
                                    </button>
                                  ) : null}
                                  {!reconcilable && !retryable && !newKeyRetry ? (
                                    <span className="text-xs text-oo-stone-gray">—</span>
                                  ) : null}
                                  {reconcileNotes[t.id] ? (
                                    <span className="max-w-[160px] text-[10px] leading-snug text-oo-stone-gray">
                                      {reconcileNotes[t.id]}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                            {t.moneyMovement ? (
                              <tr key={`${t.id}-money`} className={rowTint}>
                                <td colSpan={9} className="border-t border-oo-light-stone/60 px-3 py-3">
                                  <details className="text-xs">
                                    <summary className="cursor-pointer font-medium text-oo-stone-gray hover:text-oo-charcoal">
                                      Money movement breakdown
                                    </summary>
                                    <div className="mt-2 max-w-xl rounded-lg border border-oo-light-stone bg-white/80 p-3">
                                      <StripeMoneyMovementBreakdown
                                        compact
                                        currency={t.currency}
                                        customerPaymentCents={t.moneyMovement.customerPaymentCents}
                                        stripeProcessingFeeCents={t.moneyMovement.stripeProcessingFeeCents}
                                        stripeNetToPlatformCents={t.moneyMovement.stripeNetToPlatformCents}
                                        platformPayout={t.moneyMovement.platformPayout}
                                        vendorConnectTransferOwedCents={t.moneyMovement.vendorConnectTransferOwedCents}
                                        vendorConnectTransferStatus={adminVendorConnectTransferStatusLabel(t.status)}
                                        vendorStillOwedCents={t.moneyMovement.vendorStillOwedCents}
                                        openOrderRetainedCents={t.moneyMovement.openOrderRetainedCents}
                                        stripeTransferId={t.stripeTransferId}
                                        showBlockedNote={
                                          t.moneyMovement.vendorStillOwedCents > 0 &&
                                          (insufficient || t.status === "failed" || t.status === "blocked")
                                        }
                                      />
                                    </div>
                                  </details>
                                </td>
                              </tr>
                            ) : null}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-oo-charcoal">Transfer reversals</h2>
        <p className="text-sm text-oo-stone-gray">Stripe transfer reversals after platform refunds.</p>
        {reversalGroups.length === 0 ? (
          <p className="rounded-lg border border-dashed border-oo-light-stone bg-oo-warm-white p-8 text-center text-oo-stone-gray">
            No reversals match filters.
          </p>
        ) : (
          reversalGroups.map(([gKey, rows]) => {
            const open = isGroupOpen(gKey, expandedRevGroups);
            const total = rows.reduce((s, r) => s + r.amountCents, 0);
            return (
              <div key={gKey} className="overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm">
                <button
                  type="button"
                  onClick={() => toggleGroup(gKey, setExpandedRevGroups)}
                  className="flex w-full items-center justify-between gap-3 border-b border-oo-light-stone bg-oo-cream px-4 py-3 text-left text-sm font-semibold text-oo-charcoal hover:bg-oo-cream"
                >
                  <span>{groupTitle(gKey)}</span>
                  <span className="text-xs font-normal text-oo-stone-gray">
                    {rows.length} reversal{rows.length !== 1 ? "s" : ""} · {formatMoney(total, rows[0]?.currency ?? "usd")}
                  </span>
                </button>
                {open && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-oo-light-stone bg-oo-warm-white text-xs font-medium uppercase text-oo-stone-gray">
                        <tr>
                          <th className="px-3 py-2">Vendor</th>
                          <th className="px-3 py-2">Order</th>
                          <th className="px-3 py-2">Amount</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Stripe reversal</th>
                          <th className="px-3 py-2">Failure</th>
                          <th className="px-3 py-2">Created</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-oo-light-stone">
                        {rows.map((r) => {
                          const failed = r.status === "failed";
                          return (
                            <tr key={r.id} className={failed ? "bg-red-50/50" : ""}>
                              <td className="px-3 py-2 font-medium text-oo-charcoal">{r.vendor.name}</td>
                              <td className="px-3 py-2">
                                <Link
                                  href={`/admin/orders/${r.orderId}`}
                                  className="font-mono text-xs text-oo-charcoal hover:underline"
                                >
                                  {r.orderId.slice(-10)}
                                </Link>
                              </td>
                              <td className="px-3 py-2 tabular-nums">{formatMoney(r.amountCents, r.currency)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${reversalStatusBadgeClass(r.status)}`}
                                >
                                  {r.status}
                                </span>
                              </td>
                              <td className="max-w-[120px] truncate px-3 py-2 font-mono text-xs" title={r.stripeTransferReversalId ?? ""}>
                                {shortenStripeId(r.stripeTransferReversalId)}
                              </td>
                              <td className="px-3 py-2">
                                <ReversalFailureText text={r.failureMessage} />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-xs text-oo-stone-gray">
                                {r.createdAt.slice(0, 19).replace("T", " ")}Z
                              </td>
                              <td className="px-3 py-2">
                                {failed ? (
                                  <button
                                    type="button"
                                    disabled={retryReversalId !== null}
                                    onClick={() => void retryReversal(r.id)}
                                    className="rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
                                  >
                                    {retryReversalId === r.id ? "Retrying…" : "Retry reversal"}
                                  </button>
                                ) : (
                                  <span className="text-xs text-oo-stone-gray">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
