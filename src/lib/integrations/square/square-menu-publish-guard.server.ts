import "server-only";

import { evaluateSquareConnectionHealth } from "@/lib/integrations/square/square-connection.service";

export async function assertSquareMenuPublishAllowed(
  vendorId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const health = await evaluateSquareConnectionHealth(vendorId);
  if (health.isReady) return { ok: true };
  return {
    ok: false,
    error:
      health.missingRequirements.join("; ") ||
      "Square connection is not healthy. Reconnect Square before publishing an imported menu.",
  };
}
