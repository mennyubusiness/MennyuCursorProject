/**
 * Opt-in cart page SSR timing (set CART_PAGE_PERF_LOG=true on the server).
 */
import "server-only";

export const CART_PAGE_PERF_LOG = process.env.CART_PAGE_PERF_LOG === "true";

export function cartPagePerfMark(label: string, t0: number, extra?: Record<string, unknown>): void {
  if (!CART_PAGE_PERF_LOG) return;
  console.info("[cart-page-perf]", label, { ms: Math.round(performance.now() - t0), ...extra });
}

export function cartPagePerfNow(): number {
  return performance.now();
}
