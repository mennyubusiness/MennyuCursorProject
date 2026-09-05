import { isPodClaimPath } from "@/lib/auth/pod-claim-path";
import { isVendorClaimPath } from "@/lib/auth/vendor-claim-path";

/** Safe internal return paths for ownership claim flows (vendor or pod). */
export function isOwnershipClaimPath(path: string | null | undefined): boolean {
  return isVendorClaimPath(path) || isPodClaimPath(path);
}

export function ownershipClaimContinueLabel(path: string | null | undefined): string {
  if (isPodClaimPath(path)) return "Continue to claim pod";
  return "Continue to claim vendor";
}
