/**
 * Public customer routes vs auth-required areas for login callbacks and post-logout redirects.
 * Client + server safe (no server-only imports).
 */

import {
  AUTH_ONLY_PREFIXES,
  loginReturnPathname,
  sanitizeLoginReturnPath,
  SIGN_IN_PATH,
} from "@/lib/auth/login-return-path";

import { isCustomerPodSlugPath } from "@/lib/customer-public-url";

const PUBLIC_STATIC_PATHS = new Set([
  "/",
  "/explore",
  "/cart",
  "/checkout",
  "/about",
  "/faq",
  "/privacy",
  "/terms",
  "/sms-consent",
  "/for-pods",
]);

/** Marketplace and guest-customer pages that do not require pod/vendor membership. */
export function isPublicCustomerSafePath(pathname: string): boolean {
  const clean = pathname.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!clean.startsWith("/")) return false;

  if (PUBLIC_STATIC_PATHS.has(clean)) return true;
  if (/^\/order\/[^/]+$/.test(clean)) return true;
  if (/^\/pod\/[^/]+$/.test(clean)) return true;
  if (/^\/pod\/[^/]+\/vendor\/[^/]+$/.test(clean)) return true;
  if (isCustomerPodSlugPath(clean)) return true;

  return false;
}

function isAuthOnlyPath(pathname: string): boolean {
  const clean = pathname.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (clean === "/auth" || clean.startsWith("/auth/")) return true;

  for (const prefix of AUTH_ONLY_PREFIXES) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) {
      return true;
    }
  }

  return false;
}

/** Paths that require sign-in and should not remain visible after sign-out. */
export function isProtectedAuthPath(pathname: string): boolean {
  const clean = pathname.split("?")[0]?.split("#")[0]?.trim() ?? "";
  if (!clean.startsWith("/")) return true;

  if (isPublicCustomerSafePath(clean)) return false;
  if (isAuthOnlyPath(clean)) return true;

  if (clean === "/admin" || clean.startsWith("/admin/")) return true;
  if (clean === "/operations" || clean.startsWith("/operations/")) return true;
  if (clean === "/pod-owner" || clean.startsWith("/pod-owner/")) return true;
  if (clean === "/account" || clean.startsWith("/account/")) return true;
  if (clean === "/orders" || clean.startsWith("/orders/")) return true;
  if (clean === "/vendor" || clean.startsWith("/vendor/")) return true;
  if (clean === "/pod/dashboard") return true;

  if (isCustomerPodSlugPath(clean)) return false;

  const podSubMatch = clean.match(/^\/pod\/([^/]+)\/(.+)/);
  if (podSubMatch) {
    const sub = podSubMatch[2] ?? "";
    if (sub.startsWith("vendor/")) return false;
    return true;
  }

  return true;
}

/** Resolve where to send the user after sign-out. */
export function getPostLogoutRedirect(currentPath: string | null | undefined): string {
  const safe = sanitizeLoginReturnPath(currentPath);
  if (!safe) return SIGN_IN_PATH;

  const pathOnly = loginReturnPathname(safe);
  if (isProtectedAuthPath(pathOnly)) return SIGN_IN_PATH;

  return safe;
}
