/**
 * Safe post-login return paths (`next` query param on `/login`).
 * Shared by client (header, LoginForm) and server (post-login resolver).
 */

export const SIGN_IN_PATH = "/login";

export const LOGIN_RETURN_QUERY_PARAM = "next";

/** Default when no safe `next` is provided (customer hub, not order history). */
export const DEFAULT_CUSTOMER_POST_LOGIN_PATH = "/account";

const AUTH_ONLY_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

/**
 * Sanitize a post-login return path. Returns null if unsafe or missing.
 * Preserves query string on the path (e.g. `/pod/x?vendor=y`).
 */
export function sanitizeLoginReturnPath(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) return null;
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;

  const pathOnly = trimmed.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!pathOnly) return null;

  for (const prefix of AUTH_ONLY_PREFIXES) {
    if (pathOnly === prefix || pathOnly.startsWith(`${prefix}/`)) {
      return null;
    }
  }

  return trimmed;
}

/** Read `next` from login URL, with legacy `callbackUrl` fallback. */
export function readLoginReturnParam(
  searchParams: Pick<URLSearchParams, "get">
): string | null {
  return (
    searchParams.get(LOGIN_RETURN_QUERY_PARAM) ??
    searchParams.get("callbackUrl")
  );
}

export function buildLoginHrefWithReturn(returnPath: string): string {
  const safe = sanitizeLoginReturnPath(returnPath);
  if (!safe) return SIGN_IN_PATH;
  const params = new URLSearchParams({ [LOGIN_RETURN_QUERY_PARAM]: safe });
  return `${SIGN_IN_PATH}?${params.toString()}`;
}

/**
 * Build `/login?next=…` from current location (header Sign in).
 */
export function buildLoginHrefFromLocation(
  pathname: string | null,
  searchParams: Pick<URLSearchParams, "toString"> | null
): string {
  if (!pathname) return SIGN_IN_PATH;

  const search = searchParams?.toString();
  const fullPath = search ? `${pathname}?${search}` : pathname;
  const safe = sanitizeLoginReturnPath(fullPath);
  if (!safe) return SIGN_IN_PATH;

  return buildLoginHrefWithReturn(safe);
}

export function loginReturnPathname(safeReturnPath: string | null): string {
  if (!safeReturnPath) return "";
  return safeReturnPath.split("?")[0]?.split("#")[0]?.trim() ?? "";
}

export function isAdminReturnPath(safeReturnPath: string | null): boolean {
  const pathOnly = loginReturnPathname(safeReturnPath);
  return pathOnly === "/admin" || pathOnly.startsWith("/admin/");
}
