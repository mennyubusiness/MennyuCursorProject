/** Consistent admin cross-navigation labels across detail pages. */
export const ADMIN_NAV_LABELS = {
  openUserAdmin: "Open user admin",
  openVendorAdmin: "Open vendor admin",
  openVendorDashboard: "Open vendor dashboard",
  openPodAdmin: "Open pod admin",
  openPodDashboard: "Open pod dashboard",
  openPublicPage: "Open public page",
  openOrderAdmin: "Open order admin",
} as const;

export function buildUserAdminPath(userId: string): string {
  return `/admin/users/${userId}`;
}

export function buildVendorAdminPath(vendorId: string): string {
  return `/admin/vendors/${vendorId}`;
}

export function buildPodAdminPath(podId: string): string {
  return `/admin/pods/${podId}`;
}

export function buildVendorDashboardPath(vendorId: string): string {
  return `/vendor/${vendorId}/dashboard`;
}

export function buildPodDashboardPath(podId: string): string {
  return `/pod/${podId}/dashboard`;
}

export function buildOrderAdminPath(orderId: string): string {
  return `/admin/orders/${orderId}`;
}
