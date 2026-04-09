"use client";

import { useEffect } from "react";
import { recordPodView, recordVendorView } from "@/lib/customer-local-storage";

export function RecentPodViewTracker({ podId, podName }: { podId: string; podName: string }) {
  useEffect(() => {
    recordPodView(podId, podName);
  }, [podId, podName]);
  return null;
}

export function RecentVendorViewTracker({
  vendorId,
  podId,
  vendorName,
}: {
  vendorId: string;
  podId: string;
  vendorName: string;
}) {
  useEffect(() => {
    recordVendorView(vendorId, podId, vendorName);
  }, [vendorId, podId, vendorName]);
  return null;
}
