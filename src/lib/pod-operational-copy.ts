export type PodPublicStatusLabel = "Live" | "Not active" | "Setup needed";

export function podPublicStatusLabel(input: {
  isActive: boolean;
  hasPublicProfile: boolean;
}): PodPublicStatusLabel {
  if (!input.isActive) return "Not active";
  if (!input.hasPublicProfile) return "Setup needed";
  return "Live";
}

export function podPublicStatusTone(label: PodPublicStatusLabel): "success" | "warning" | "neutral" {
  if (label === "Live") return "success";
  if (label === "Setup needed") return "warning";
  return "neutral";
}

export const POD_ALL_READY_COPY = "Your pod is ready for customers.";
