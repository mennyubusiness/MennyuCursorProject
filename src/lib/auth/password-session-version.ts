/** JWT session invalidation after password reset — pure helpers (testable without DB). */

export function passwordChangedAtToJwtMs(at: Date | null | undefined): number | null {
  if (!at) return null;
  return at.getTime();
}

/**
 * Returns true when the JWT was issued with the current password version.
 * Both null means legacy user who has never reset — always valid.
 */
export function isJwtSessionValidForPasswordVersion(
  tokenPasswordChangedAtMs: number | null | undefined,
  dbPasswordChangedAtMs: number | null | undefined
): boolean {
  const tokenMs = tokenPasswordChangedAtMs ?? null;
  const dbMs = dbPasswordChangedAtMs ?? null;
  return tokenMs === dbMs;
}
