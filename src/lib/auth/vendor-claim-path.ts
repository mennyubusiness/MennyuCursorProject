const VENDOR_CLAIM_PREFIX = "/claim/vendor/";

export function isVendorClaimPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const clean = path.split("?")[0] ?? "";
  return clean.startsWith(VENDOR_CLAIM_PREFIX) && clean.length > VENDOR_CLAIM_PREFIX.length;
}
