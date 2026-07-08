/** Warnings that are deployment diagnostics only — never shown as vendor setup blockers. */
const INTERNAL_SQUARE_WARNING_PATTERNS = [
  /SQUARE_OAUTH_REDIRECT_URL uses production domain/i,
  /SQUARE_OAUTH_REDIRECT_URL hostname looks non-production/i,
  /SQUARE_APPLICATION_ID looks like production credentials/i,
  /SQUARE_WEBHOOK_SIGNATURE_KEY/i,
  /Connected Square credentials are from .* but deployment SQUARE_ENVIRONMENT/i,
];

export function isSquareInternalDiagnosticWarning(message: string): boolean {
  return INTERNAL_SQUARE_WARNING_PATTERNS.some((pattern) => pattern.test(message));
}

export function filterSquareVendorFacingWarnings(warnings: string[]): string[] {
  return warnings.filter((w) => !isSquareInternalDiagnosticWarning(w));
}
