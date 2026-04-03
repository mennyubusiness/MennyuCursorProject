/**
 * Shared Prisma interactive-transaction settings for large menu writes (publish + rollback).
 * Prisma's default interactive `timeout` is 5s — large menus exceed that and the next `tx.*`
 * call fails with "Transaction not found".
 */
import "server-only";

export const MENU_PUBLISH_LOG_PREFIX = "[menu-publish]";

/** Clamp: min 10s, max 10m; default 5m. Override with MENU_PUBLISH_TRANSACTION_TIMEOUT_MS. */
export function getMenuPublishTransactionOptions(): { maxWait: number; timeout: number } {
  const raw = process.env.MENU_PUBLISH_TRANSACTION_TIMEOUT_MS;
  const parsed = raw != null && raw !== "" ? Number(raw) : NaN;
  const timeout = Number.isFinite(parsed)
    ? Math.min(Math.max(Math.trunc(parsed), 10_000), 600_000)
    : 300_000;
  return { maxWait: 60_000, timeout };
}

export function logMenuPublish(
  phase: string,
  data: Record<string, unknown> & { jobId?: string; vendorId?: string }
): void {
  console.info(MENU_PUBLISH_LOG_PREFIX, phase, { ...data, atMs: Date.now() });
}
