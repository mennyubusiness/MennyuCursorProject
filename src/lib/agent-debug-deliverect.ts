/**
 * Debug session `14d56b`: structured traces for Deliverect submit + inbound webhooks.
 * - `console.info` lines prefixed `[AGENT_DEBUG_DELIVERECT]` (visible on Vercel / local server logs).
 * - NDJSON POST to local ingest when available (Cursor debug session); fails silently on Vercel.
 */
const INGEST =
  "http://127.0.0.1:7930/ingest/27762b6e-2300-401d-857d-6d80de8e5af0";
const SESSION = "14d56b";

export function agentDebugDeliverect(payload: {
  hypothesisId: string;
  message: string;
  data?: Record<string, unknown>;
}): void {
  const line = JSON.stringify({
    sessionId: SESSION,
    timestamp: Date.now(),
    ...payload,
  });
  console.info(`[AGENT_DEBUG_DELIVERECT] ${line}`);
  // #region agent log
  fetch(INGEST, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": SESSION,
    },
    body: line,
  }).catch(() => {});
  // #endregion
}

/** Redact channel link / location to last 4 chars for logs. */
export function redactIdTail(id: string | undefined | null): string | null {
  if (id == null || String(id).trim() === "") return null;
  const s = String(id).trim();
  if (s.length <= 4) return "****";
  return `****${s.slice(-4)}`;
}
