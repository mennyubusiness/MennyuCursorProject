"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const VENDOR_ORDERS_POLL_INTERVAL_MS = 5000;
export const VENDOR_ORDERS_AGE_TICK_MS = 60_000;

export type VendorOrderPollRow = { id: string };

export function useVendorOrdersPoll<T extends VendorOrderPollRow>(params: {
  vendorId: string;
  initialOrders: T[];
  initialNowMs: number;
  enabled?: boolean;
}): {
  vendorOrders: T[];
  setVendorOrders: (value: T[] | ((prev: T[]) => T[])) => void;
  nowMs: number;
  onStatusSuccess: (vendorOrderId: string, update: { routingStatus: string; fulfillmentStatus: string }) => void;
  fetchError: string | null;
  refresh: () => Promise<void>;
  isPolling: boolean;
} {
  const { vendorId, initialOrders, initialNowMs, enabled = true } = params;
  const [vendorOrders, setVendorOrders] = useState<T[]>(initialOrders);
  const [nowMs, setNowMs] = useState(initialNowMs);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const onStatusSuccess = useCallback(
    (vendorOrderId: string, update: { routingStatus: string; fulfillmentStatus: string }) => {
      setVendorOrders((prev) =>
        prev.map((vo) =>
          vo.id === vendorOrderId
            ? ({ ...vo, routingStatus: update.routingStatus, fulfillmentStatus: update.fulfillmentStatus } as T)
            : vo
        )
      );
    },
    []
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsPolling(true);
    try {
      const res = await fetch(`/api/vendor/${vendorId}/orders`);
      if (!res.ok) {
        setFetchError("Could not refresh orders. Try again.");
        return;
      }
      const data = await res.json();
      setVendorOrders((data.vendorOrders ?? []) as T[]);
      setFetchError(null);
    } catch {
      setFetchError("Could not refresh orders. Check your connection.");
    } finally {
      setIsPolling(false);
    }
  }, [enabled, vendorId]);

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), VENDOR_ORDERS_AGE_TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onVisibility = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    if (!enabled || !isVisible) return;
    const ac = new AbortController();
    const fetchOrders = async () => {
      setIsPolling(true);
      try {
        const res = await fetch(`/api/vendor/${vendorId}/orders`, { signal: ac.signal });
        if (!res.ok) {
          setFetchError("Could not refresh orders.");
          return;
        }
        const data = await res.json();
        setVendorOrders((data.vendorOrders ?? []) as T[]);
        setFetchError(null);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setFetchError("Could not refresh orders.");
        }
      } finally {
        setIsPolling(false);
      }
    };

    void fetchOrders();
    const id = setInterval(fetchOrders, VENDOR_ORDERS_POLL_INTERVAL_MS);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, [vendorId, isVisible, enabled]);

  const initialRef = useRef(initialOrders);
  useEffect(() => {
    if (initialRef.current !== initialOrders) {
      initialRef.current = initialOrders;
      setVendorOrders(initialOrders);
      setNowMs(initialNowMs);
    }
  }, [initialOrders, initialNowMs]);

  return {
    vendorOrders,
    setVendorOrders,
    nowMs,
    onStatusSuccess,
    fetchError,
    refresh,
    isPolling,
  };
}
