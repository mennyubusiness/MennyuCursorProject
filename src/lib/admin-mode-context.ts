import "server-only";

import { cookies, headers } from "next/headers";
import { auth } from "@/auth";
import {
  ADMIN_COOKIE_NAME,
  isAdminAllowed,
} from "@/lib/admin-auth";
import {
  isPodElevatedDashboardPath,
  isVendorElevatedDashboardPath,
} from "@/lib/admin-mode-banner-paths";
import { env } from "@/lib/env";

export { isPodElevatedDashboardPath, isVendorElevatedDashboardPath } from "@/lib/admin-mode-banner-paths";

/** Platform admin or admin-secret bridge — not normal pod/vendor owners. */
export async function isElevatedAdminAccess(): Promise<boolean> {
  const session = await auth();
  if (session?.user?.isPlatformAdmin) return true;

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? null;

  if (env.NODE_ENV === "development") {
    const secret = env.ADMIN_SECRET;
    if (secret && cookieValue?.trim() === secret) return true;
    return false;
  }

  return isAdminAllowed(cookieValue, null);
}

async function currentPathname(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-pathname") ?? "";
}

/**
 * Yellow admin marquee on pod operator pages when an admin uses elevated access.
 * Never shown on /admin/* or public customer routes.
 */
export async function shouldShowAdminModeBannerForPod(podId: string): Promise<boolean> {
  const pathname = await currentPathname();
  if (pathname.startsWith("/admin")) return false;
  if (!(await isElevatedAdminAccess())) return false;
  return isPodElevatedDashboardPath(pathname, podId);
}

/**
 * Yellow admin marquee on vendor operator pages when an admin uses elevated access.
 * Never shown on /admin/* or public customer routes.
 */
export async function shouldShowAdminModeBannerForVendor(vendorId: string): Promise<boolean> {
  const pathname = await currentPathname();
  if (pathname.startsWith("/admin")) return false;
  if (!(await isElevatedAdminAccess())) return false;
  return isVendorElevatedDashboardPath(pathname, vendorId);
}
