import type { PodOrderingStatusTone } from "@/lib/pod-page-status";
import type { PodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";

export const DESTINATION_GROUP_PROMPT_STORAGE_PREFIX = "openOrder.destinationGroupPromptDismissed.";

export function destinationGroupPromptStorageKey(podId: string): string {
  return `${DESTINATION_GROUP_PROMPT_STORAGE_PREFIX}${podId}`;
}

export function isDestinationGroupPromptDismissed(
  podId: string,
  storage: Pick<Storage, "getItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null
): boolean {
  if (!storage) return false;

  try {
    return storage.getItem(destinationGroupPromptStorageKey(podId)) === "1";
  } catch {
    return false;
  }
}

export function markDestinationGroupPromptDismissed(
  podId: string,
  storage: Pick<Storage, "setItem"> | null | undefined = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null
): void {
  if (!storage) return;

  try {
    storage.setItem(destinationGroupPromptStorageKey(podId), "1");
  } catch {
    // Ignore private browsing / blocked storage.
  }
}

/** Server-side eligibility before client hydration and session dismissal. */
export function shouldOfferDestinationGroupOrderPrompt(input: {
  hasVendors: boolean;
  isQrEntry: boolean;
  ctaStateKind: PodPageGroupOrderCtaState["kind"];
  orderingTone: PodOrderingStatusTone;
}): boolean {
  if (!input.hasVendors) return false;
  if (input.isQrEntry) return false;
  if (input.ctaStateKind !== "start") return false;
  if (input.orderingTone === "empty") return false;
  return true;
}

/** Client-side open check after hydration. */
export function shouldOpenDestinationGroupOrderPrompt(input: {
  offerPrompt: boolean;
  dismissed: boolean;
}): boolean {
  return input.offerPrompt && !input.dismissed;
}
