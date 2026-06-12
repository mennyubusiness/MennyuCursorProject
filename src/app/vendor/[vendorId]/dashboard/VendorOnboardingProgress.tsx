import type { ReadinessChecklistItem } from "@/lib/vendor-pod-readiness";
import { VendorSetupChecklist } from "@/components/vendor/VendorSetupChecklist";

type Props = {
  checklist: ReadinessChecklistItem[];
};

/** Vendor settings onboarding panel — checklist derived from vendor-pod-readiness on the server. */
export function VendorOnboardingProgress({ checklist }: Props) {
  return <VendorSetupChecklist items={checklist} />;
}
