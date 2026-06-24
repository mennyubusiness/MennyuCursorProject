import type { DashboardStatusTone } from "@/components/dashboard/dashboard-styles";

/** Maps pod-owner vendor roster/adoption display labels to shared dashboard badge tones. */
export function podVendorDisplayStatusTone(displayStatus: string): DashboardStatusTone {
  if (displayStatus === "Live") return "success";
  if (
    displayStatus.startsWith("Needs ") ||
    displayStatus === "Paused in pod" ||
    displayStatus === "Paused by vendor"
  ) {
    return "warning";
  }
  return "neutral";
}
