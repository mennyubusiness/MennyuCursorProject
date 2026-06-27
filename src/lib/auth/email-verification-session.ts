export function emailVerifiedToJwtMs(emailVerified: Date | null | undefined): number | null {
  if (!emailVerified) return null;
  return emailVerified.getTime();
}

export function isJwtEmailVerified(emailVerifiedMs: number | null | undefined): boolean {
  return typeof emailVerifiedMs === "number" && Number.isFinite(emailVerifiedMs);
}
