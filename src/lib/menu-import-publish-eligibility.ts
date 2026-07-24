import {
  MenuImportIssueSeverity,
  MenuImportJobStatus,
  MenuVersionState,
} from "@prisma/client";
import { openOrderCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";

export type MenuImportPublishDisplayState =
  | "live"
  | "no_pending_draft"
  | "ready"
  | "blocked"
  | "failed"
  | "processing";

export type PublishEligibility = {
  canPublish: boolean;
  displayState: MenuImportPublishDisplayState;
  /** Actionable blockers only — never internal workflow states. */
  blockers: string[];
  /** Calm success or informational copy; no warning styling required. */
  infoMessage: string | null;
  /** When true, show an amber warning with `blockers`. */
  showPublishWarning: boolean;
  /** @deprecated Prefer `blockers` — kept for callers that still read `reasons`. */
  reasons: string[];
};

const IN_PROGRESS_STATUSES: ReadonlySet<MenuImportJobStatus> = new Set([
  MenuImportJobStatus.queued,
  MenuImportJobStatus.fetching,
  MenuImportJobStatus.ingested,
  MenuImportJobStatus.normalizing,
  MenuImportJobStatus.validating,
  MenuImportJobStatus.publishing,
]);

/** Read-only checks for admin/vendor UI (mirrors publish service gates). */
export function evaluateMenuImportPublishEligibility(input: {
  status: MenuImportJobStatus;
  draftVersionId: string | null;
  draftVersion: { state: MenuVersionState; canonicalSnapshot: unknown } | null;
  issues: Array<{ severity: MenuImportIssueSeverity; waived: boolean }>;
}): PublishEligibility {
  const versionState = input.draftVersion?.state;

  if (
    input.status === MenuImportJobStatus.succeeded &&
    versionState === MenuVersionState.published
  ) {
    return liveEligibility("Menu is live.");
  }

  if (versionState === MenuVersionState.published) {
    return liveEligibility("This menu has already been published.");
  }

  if (input.status === MenuImportJobStatus.failed) {
    const blockers = ["Menu publish failed. Please try again."];
    return {
      canPublish: false,
      displayState: "failed",
      blockers,
      reasons: blockers,
      infoMessage: null,
      showPublishWarning: true,
    };
  }

  if (input.status === MenuImportJobStatus.cancelled) {
    return {
      canPublish: false,
      displayState: "no_pending_draft",
      blockers: [],
      reasons: [],
      infoMessage: "No menu changes are waiting to publish.",
      showPublishWarning: false,
    };
  }

  if (IN_PROGRESS_STATUSES.has(input.status)) {
    const infoMessage =
      input.status === MenuImportJobStatus.publishing
        ? "Menu publish is in progress."
        : "Menu changes are still being processed.";
    return {
      canPublish: false,
      displayState: "processing",
      blockers: [],
      reasons: [],
      infoMessage,
      showPublishWarning: false,
    };
  }

  if (input.status === MenuImportJobStatus.awaiting_review) {
    return evaluateAwaitingReviewDraft(input);
  }

  return {
    canPublish: false,
    displayState: "no_pending_draft",
    blockers: [],
    reasons: [],
    infoMessage: "No menu changes are waiting to publish.",
    showPublishWarning: false,
  };
}

function liveEligibility(infoMessage: string): PublishEligibility {
  return {
    canPublish: false,
    displayState: "live",
    blockers: [],
    reasons: [],
    infoMessage,
    showPublishWarning: false,
  };
}

/** When no import job is linked or nothing is waiting to publish. */
export function noPendingMenuPublishEligibility(): PublishEligibility {
  return {
    canPublish: false,
    displayState: "no_pending_draft",
    blockers: [],
    reasons: [],
    infoMessage: "No menu changes are waiting to publish.",
    showPublishWarning: false,
  };
}

function evaluateAwaitingReviewDraft(input: {
  draftVersionId: string | null;
  draftVersion: { state: MenuVersionState; canonicalSnapshot: unknown } | null;
  issues: Array<{ severity: MenuImportIssueSeverity; waived: boolean }>;
}): PublishEligibility {
  const blockers: string[] = [];

  if (!input.draftVersionId || !input.draftVersion) {
    blockers.push("This menu update is missing draft data. Import the menu again or contact support.");
  } else if (input.draftVersion.state !== MenuVersionState.draft) {
    return liveEligibility("No menu changes are waiting to publish.");
  }

  const parsed = input.draftVersion
    ? openOrderCanonicalMenuSchema.safeParse(input.draftVersion.canonicalSnapshot)
    : null;
  if (input.draftVersion && !parsed?.success) {
    blockers.push("Menu data could not be read. Try importing the menu again.");
  }
  if (parsed?.success && parsed.data.products.length === 0) {
    blockers.push("Add at least one menu item before publishing.");
  }
  if (parsed?.success) {
    const availableCount = parsed.data.products.filter((product) => product.isAvailable).length;
    if (parsed.data.products.length > 0 && availableCount === 0) {
      blockers.push("Add at least one available menu item before publishing.");
    }
  }

  const blocking = input.issues.filter(
    (issue) => issue.severity === MenuImportIssueSeverity.blocking && !issue.waived
  ).length;
  if (blocking > 0) {
    blockers.push(
      blocking === 1
        ? "Fix 1 critical issue before publishing."
        : `Fix ${blocking} critical issues before publishing.`
    );
  }

  const canPublish = blockers.length === 0;
  return {
    canPublish,
    displayState: canPublish ? "ready" : "blocked",
    blockers,
    reasons: blockers,
    infoMessage: canPublish ? "Review and publish changes when you're ready." : null,
    showPublishWarning: !canPublish,
  };
}
