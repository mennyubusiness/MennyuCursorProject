/**
 * Guarded admin/dev QA tools (routing failure simulation, etc.).
 * Hidden in production unless ENABLE_ADMIN_TEST_TOOLS=true.
 */
import "server-only";

import { auth } from "@/auth";
import { env } from "@/lib/env";

export function isAdminTestToolsEnabled(): boolean {
  return env.NODE_ENV !== "production" || env.ENABLE_ADMIN_TEST_TOOLS === "true";
}

/** Server components: show dev QA controls only for platform admins when tools are enabled. */
export async function canShowAdminTestToolsUi(): Promise<boolean> {
  if (!isAdminTestToolsEnabled()) return false;
  const session = await auth();
  return Boolean(session?.user?.isPlatformAdmin);
}

export type AdminTestToolsGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Route handlers: platform admin session required; returns 404 when tools disabled (hide in prod).
 */
export async function assertAdminTestToolsApiAccess(): Promise<AdminTestToolsGateResult> {
  if (!isAdminTestToolsEnabled()) {
    return { ok: false, status: 404, error: "Not found", code: "DISABLED" };
  }
  const session = await auth();
  if (!session?.user?.isPlatformAdmin) {
    return { ok: false, status: 403, error: "Platform admin required.", code: "FORBIDDEN" };
  }
  return { ok: true };
}
