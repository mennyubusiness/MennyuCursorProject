import type { RefundDecision } from "@/lib/refund-decision";
import {
  processRefundDecision,
  toApiRefundPayload,
} from "@/services/refund-execution.service";

/** Shared cancel/denial refund attempt after a RefundDecision is computed. */
export async function runAutomaticRefundForDecision(
  decision: RefundDecision,
  opts?: { customerVisibleNote?: string | null }
) {
  const processed = await processRefundDecision(decision, opts);
  return toApiRefundPayload(processed);
}
