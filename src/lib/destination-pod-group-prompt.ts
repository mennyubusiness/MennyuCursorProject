import type { PodOrderingStatusTone } from "@/lib/pod-page-status";
import type { PodPageGroupOrderCtaState } from "@/lib/pod-page-group-order-cta";

export const DESTINATION_GROUP_PROMPT_STORAGE_PREFIX = "openOrder.destinationGroupPromptDismissed.";

export function destinationGroupPromptStorageKey(podId: string): string {
  return `${DESTINATION_GROUP_PROMPT_STORAGE_PREFIX}${podId}`;
}

const GROUP_JOIN_SEARCH_PARAM_KEYS = ["code", "join", "joinCode", "groupJoin"] as const;

/** True when the pod URL carries an explicit join-code or join intent query param. */
export function hasExplicitGroupJoinIntentFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  for (const key of GROUP_JOIN_SEARCH_PARAM_KEYS) {
    const raw = searchParams[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    if (value) return true;
  }
  return false;
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
  /** When true, skip the generic prompt so an explicit join flow can take over. */
  hasExplicitJoinIntent?: boolean;
}): boolean {
  if (!input.hasVendors) return false;
  if (!input.isQrEntry) return false;
  if (input.hasExplicitJoinIntent) return false;
  if (input.ctaStateKind !== "start") return false;
  if (input.orderingTone === "empty") return false;
  /** Group ordering is an ordering feature; a menu-only pod has nothing to group-order from. */
  if (input.orderingTone === "menu_only") return false;
  return true;
}

/** Client-side open check after hydration. */
export function shouldOpenDestinationGroupOrderPrompt(input: {
  offerPrompt: boolean;
  dismissed: boolean;
}): boolean {
  return input.offerPrompt && !input.dismissed;
}
