/** Whether the global quick cart drawer should be available on this route. */
export function isQuickCartEnabledForPath(pathname: string): boolean {
  if (!pathname || pathname.startsWith("/admin")) return false;
  if (pathname === "/cart" || pathname.startsWith("/checkout")) return false;

  if (pathname.startsWith("/vendor/")) {
    const rest = pathname.slice("/vendor/".length);
    const seg = rest.split("/")[1];
    if (seg && seg !== "select") return false;
  }

  if (/^\/pod\/[^/]+\/(dashboard|settings|analytics)/.test(pathname)) return false;

  return true;
}
