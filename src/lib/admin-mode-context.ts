import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import {
  ADMIN_COOKIE_NAME,
  isAdminAllowed,
  isAdminDashboardLayoutAuthorized,
} from "@/lib/admin-auth";
import { env } from "@/lib/env";

export type AdminModeBannerScope = "admin" | "operational";

/**
 * Whether to show the yellow admin mode marquee.
 * - `admin`: /admin/* layouts (authorized admin session or bridge).
 * - `operational`: vendor/pod dashboards when acting with elevated admin access,
 *   not for normal vendor/pod owners without platform admin or secret bridge.
 */
export async function shouldShowAdminModeBanner(scope: AdminModeBannerScope): Promise<boolean> {
  if (scope === "admin") {
    return isAdminDashboardLayoutAuthorized();
  }

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
