export function isUserEmailVerified(emailVerified: Date | null | undefined): boolean {
  return emailVerified != null;
}
