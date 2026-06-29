const POD_DASHBOARD_SEGMENTS = [
  "dashboard",
  "vendors",
  "analytics",
  "promote",
  "payouts",
  "setup",
  "settings",
] as const;

/** Pod owner/operator workspace routes, not legacy customer menu redirects. */
export function isPodElevatedDashboardPath(pathname: string, podId: string): boolean {
  const prefix = `/pod/${podId}/`;
  if (!pathname.startsWith(prefix)) return false;

  const rest = pathname.slice(prefix.length);
  if (!rest) return false;

  const firstSegment = rest.split("/")[0] ?? "";
  if (firstSegment === "vendor") return false;

  return POD_DASHBOARD_SEGMENTS.includes(firstSegment as (typeof POD_DASHBOARD_SEGMENTS)[number]);
}

/** Vendor operator workspace under /vendor/[vendorId]/* (not public slug menus). */
export function isVendorElevatedDashboardPath(pathname: string, vendorId: string): boolean {
  return pathname.startsWith(`/vendor/${vendorId}/`);
}
