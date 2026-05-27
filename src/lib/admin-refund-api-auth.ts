import { auth } from "@/auth";
import { env } from "@/lib/env";
import { isAdminApiRequestAuthorized } from "@/lib/admin-auth";

/**
 * Resolves platform-admin user id for refund execution.
 * Production requires an authenticated platform-admin session (not secret bridge alone).
 */
export async function resolvePlatformAdminUserIdForRefund(
  request: Request
): Promise<string | null> {
  if (!(await isAdminApiRequestAuthorized(request))) {
    return null;
  }
  const session = await auth();
  if (session?.user?.isPlatformAdmin && session.user.id) {
    return session.user.id;
  }
  if (env.NODE_ENV === "development") {
    return session?.user?.id ?? "admin-bridge";
  }
  return null;
}
