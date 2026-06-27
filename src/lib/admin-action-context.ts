import "server-only";

import { auth } from "@/auth";
import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";

export type AdminActionContext =
  | { ok: true; adminUserId: string | null }
  | { ok: false; error: string };

export async function requireAdminActionContext(): Promise<AdminActionContext> {
  const authorized = await isAdminDashboardLayoutAuthorized();
  if (!authorized) {
    return { ok: false, error: "Unauthorized." };
  }
  const session = await auth();
  return { ok: true, adminUserId: session?.user?.id ?? null };
}

export async function countActivePlatformAdmins(excludeUserId?: string): Promise<number> {
  const { prisma } = await import("@/lib/db");
  return prisma.user.count({
    where: {
      isPlatformAdmin: true,
      disabledAt: null,
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
  });
}
