const POD_CLAIM_PREFIX = "/claim/pod/";

export function isPodClaimPath(path: string | null | undefined): boolean {
  if (!path) return false;
  const clean = path.split("?")[0] ?? "";
  return clean.startsWith(POD_CLAIM_PREFIX) && clean.length > POD_CLAIM_PREFIX.length;
}
