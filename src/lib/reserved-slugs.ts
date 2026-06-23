/**
 * Root-level path segments reserved for first-party app routes.
 * Pods and vendors cannot claim these slugs.
 */
export const RESERVED_PUBLIC_SLUGS = [
  "account",
  "admin",
  "api",
  "about",
  "apple-icon",
  "cart",
  "checkout",
  "dev",
  "explore",
  "faq",
  "for-pods",
  "forgot-password",
  "group-order",
  "icon",
  "login",
  "opengraph-image",
  "order",
  "orders",
  "pod",
  "privacy",
  "register",
  "reset-password",
  "sign-in",
  "sign-up",
  "sms-consent",
  "terms",
  "vendor",
] as const;

export type ReservedPublicSlug = (typeof RESERVED_PUBLIC_SLUGS)[number];

const RESERVED_SET = new Set<string>(RESERVED_PUBLIC_SLUGS);

export function isReservedPublicSlug(slug: string): boolean {
  return RESERVED_SET.has(slug.trim().toLowerCase());
}

export function assertSlugNotReserved(slug: string, label = "slug"): void {
  if (isReservedPublicSlug(slug)) {
    throw new Error(`${label} "${slug}" is reserved and cannot be used.`);
  }
}
