"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { DashboardEmptyState } from "@/components/dashboard";
import { useVendorOrdersPoll } from "@/hooks/useVendorOrdersPoll";
import { VENDOR_POS_BOARD_READONLY_COPY } from "@/lib/vendor-operational-copy";
import {
  filterVendorOrdersLedger,
  groupIssuesByVendorOrderId,
  parseVendorOrdersLedgerFilter,
  VENDOR_ORDERS_LEDGER_DATE_FILTERS,
  VENDOR_ORDERS_LEDGER_EMPTY,
  VENDOR_ORDERS_LEDGER_FILTERS,
  type VendorOrdersLedgerDateFilter,
  type VendorOrdersLedgerFilter,
  type VendorOrdersLedgerOrder,
} from "@/lib/vendor-orders-ledger-filters";
import type { VendorOrderIssueRow } from "@/services/vendor-order-issue.service";
import { VendorKitchenPauseToggle } from "../kitchen/VendorKitchenPauseToggle";
import { VendorOrdersLedgerRow as VendorOrdersLedgerRowCard } from "./VendorOrdersLedgerRow";

type LedgerOrder = VendorOrdersLedgerOrder;

export function VendorOrdersLedger({
  vendorId,
  initialVendorOrders,
  initialNowMs,
  isDeliverectLive,
  orderRoutingMode: _orderRoutingMode,
  posManaged,
  initialPaused,
}: {
  vendorId: string;
  vendorName: string;
  vendorDeliverectChannelLinkId: string | null;
  initialVendorOrders: LedgerOrder[];
  initialNowMs: number;
  isDeliverectLive: boolean;
  orderRoutingMode: import("@prisma/client").VendorOrderRoutingMode;
  posManaged: boolean;
  initialPaused: boolean;
}) {
  const searchParams = useSearchParams();
  const initialFilter = parseVendorOrdersLedgerFilter(searchParams.get("filter"));

  const [ledgerFilter, setLedgerFilter] = useState<VendorOrdersLedgerFilter>(initialFilter);
  const [dateFilter, setDateFilter] = useState<VendorOrdersLedgerDateFilter>("all");
  const [pickupSearch, setPickupSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [issues, setIssues] = useState<VendorOrderIssueRow[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const { vendorOrders, nowMs, fetchError, refresh, isPolling, lastFetchedAtMs } = useVendorOrdersPoll({
    vendorId,
    initialOrders: initialVendorOrders,
    initialNowMs,
  });

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await fetch(`/api/vendor/${vendorId}/order-issues?filter=all`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setIssuesError(data.error ?? "Could not load order issues.");
        setIssues([]);
        return;
      }
      setIssues(data.issues ?? []);
    } catch {
      setIssuesError("Could not load order issues.");
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    void loadIssues();
  }, [loadIssues]);

  useEffect(() => {
    setLedgerFilter(parseVendorOrdersLedgerFilter(searchParams.get("filter")));
  }, [searchParams]);

  const issuesByVendorOrderId = useMemo(() => groupIssuesByVendorOrderId(issues), [issues]);

  const filteredOrders = useMemo(
    () =>
      filterVendorOrdersLedger(
        vendorOrders,
        ledgerFilter,
        dateFilter,
        nowMs,
        isDeliverectLive,
        issuesByVendorOrderId,
        pickupSearch
      ),
    [
      vendorOrders,
      ledgerFilter,
      dateFilter,
      nowMs,
      isDeliverectLive,
      issuesByVendorOrderId,
      pickupSearch,
    ]
  );

  const emptyCopy = VENDOR_ORDERS_LEDGER_EMPTY[ledgerFilter];
  const connectionLabel =
    fetchError != null
      ? "Connection issue"
      : lastFetchedAtMs != null && nowMs - lastFetchedAtMs < 15_000
        ? "Live"
        : "Updating…";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-oo-stone-gray">
          Newest first · {vendorOrders.length} loaded
          {vendorOrders.length >= 100 ? " (latest 100)" : ""}
          <span className="mx-2 text-oo-light-stone">·</span>
          <span className={fetchError ? "text-red-700" : "text-oo-stone-gray"}>{connectionLabel}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/vendor/${vendorId}/kitchen`}
            className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-hover"
          >
            Open Kitchen Mode
          </Link>
          <VendorKitchenPauseToggle
            vendorId={vendorId}
            initialPaused={initialPaused}
            variant="orders"
            posManaged={posManaged}
          />
        </div>
      </div>

      {posManaged ? (
        <p className="rounded-xl border border-oo-light-stone bg-oo-cream/60 px-4 py-3 text-sm text-oo-stone-gray">
          {VENDOR_POS_BOARD_READONLY_COPY}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {VENDOR_ORDERS_LEDGER_FILTERS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setLedgerFilter(chip.id)}
            className={`min-h-[40px] rounded-full px-4 py-2 text-sm font-semibold transition ${
              ledgerFilter === chip.id
                ? "bg-oo-charcoal text-white"
                : "border border-oo-light-stone bg-oo-warm-white text-oo-charcoal hover:bg-oo-cream"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex flex-wrap gap-2">
          {VENDOR_ORDERS_LEDGER_DATE_FILTERS.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setDateFilter(chip.id)}
              className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                dateFilter === chip.id
                  ? "bg-oo-cream text-oo-charcoal ring-1 ring-oo-light-stone"
                  : "text-oo-stone-gray hover:bg-oo-cream/60 hover:text-oo-charcoal"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <label className="min-w-[12rem] flex-1">
          <span className="sr-only">Search by pickup code</span>
          <input
            type="search"
            value={pickupSearch}
            onChange={(e) => setPickupSearch(e.target.value)}
            placeholder="Search pickup code"
            className="w-full rounded-xl border border-oo-light-stone bg-oo-warm-white px-4 py-2.5 text-sm"
          />
        </label>
      </div>

      {fetchError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={() => void refresh()}
            className="min-h-[40px] rounded-lg bg-red-800 px-3 py-1.5 font-semibold text-white hover:bg-red-900"
          >
            Retry
          </button>
        </div>
      ) : null}

      {issuesError ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>{issuesError}</span>
          <button
            type="button"
            onClick={() => void loadIssues()}
            className="min-h-[40px] rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold hover:bg-amber-100"
          >
            Retry issues
          </button>
        </div>
      ) : null}

      {isPolling && vendorOrders.length === 0 && !fetchError ? (
        <p className="text-sm text-oo-stone-gray">Loading orders…</p>
      ) : null}

      {issuesLoading && issues.length === 0 && !issuesError ? (
        <p className="text-xs text-oo-stone-gray">Loading issue data…</p>
      ) : null}

      {filteredOrders.length === 0 && !isPolling ? (
        <DashboardEmptyState title={emptyCopy.title} description={emptyCopy.description} />
      ) : (
        <ul className="space-y-3">
          {filteredOrders.map((vendorOrder) => (
            <VendorOrdersLedgerRowCard
              key={vendorOrder.id}
              vendorId={vendorId}
              vendorOrder={vendorOrder}
              issues={issuesByVendorOrderId.get(vendorOrder.id) ?? []}
              isDeliverectLive={isDeliverectLive}
              posManaged={posManaged}
              expanded={expandedId === vendorOrder.id}
              onToggleExpanded={() =>
                setExpandedId((current) => (current === vendorOrder.id ? null : vendorOrder.id))
              }
              onIssuesUpdated={() => void loadIssues()}
            />
          ))}
        </ul>
      )}

      <p className="text-xs text-oo-stone-gray sm:text-sm">
        For live service, use{" "}
        <Link href={`/vendor/${vendorId}/kitchen`} className="font-semibold text-brand hover:underline">
          Kitchen Mode
        </Link>
        . Status changes happen there for active orders.
      </p>
    </div>
  );
}
