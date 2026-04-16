"use client";

import { useEffect } from "react";

/**
 * When landing from explore search with ?highlightVendor=, scroll the matching vendor card into view.
 */
export function ScrollPodVendorIntoView({ vendorId }: { vendorId: string | null }) {
  useEffect(() => {
    if (!vendorId) return;
    const id = `pod-vendor-${vendorId}`;
    const run = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    run();
    const t = window.setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [vendorId]);
  return null;
}
