/** Shared email/password rules for registration and password recovery. */

export const MIN_PASSWORD_LENGTH = 8;

export function normalizeAccountEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

export function validateAccountEmail(email: string): string | null {
  const normalized = normalizeAccountEmail(email);
  if (!normalized.includes("@")) {
    return "Enter a valid email.";
  }
  return null;
}

export function validateAccountPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
