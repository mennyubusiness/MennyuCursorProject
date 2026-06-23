"use client";

import { useEffect } from "react";
import { recordPodView, recordVendorView } from "@/lib/customer-local-storage";

export function RecentPodViewTracker({
  podId,
  podSlug,
  podName,
}: {
  podId: string;
  podSlug: string;
  podName: string;
}) {
  useEffect(() => {
    recordPodView(podId, podName, podSlug);
  }, [podId, podSlug, podName]);
  return null;
}

export function RecentVendorViewTracker({
  vendorId,
  podId,
  podSlug,
  vendorSlug,
  vendorName,
}: {
  vendorId: string;
  podId: string;
  podSlug: string;
  vendorSlug: string;
  vendorName: string;
}) {
  useEffect(() => {
    recordVendorView(vendorId, podId, vendorName, { podSlug, vendorSlug });
  }, [vendorId, podId, podSlug, vendorSlug, vendorName]);
  return null;
}
