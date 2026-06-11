/** Primary marketing navigation (global header). */
export const SITE_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/for-pods", label: "For Pods" },
  { href: "/faq", label: "FAQ" },
  { href: "/explore", label: "Explore" },
] as const;

export function isSiteNavLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
