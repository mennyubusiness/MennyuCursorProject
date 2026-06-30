import { canonicalMenuSourceFromSnapshot } from "@/lib/vendor-menu-source";

export type MenuBuilderPublishStatusKind =
  | "live"
  | "unpublished"
  | "never_published"
  | "needs_attention";

export type MenuBuilderPublishStatusView = {
  kind: MenuBuilderPublishStatusKind;
  headline: string;
  detail: string;
  blockerCount: number;
};

export function hasOpenOrderMenuUnpublishedChanges(input: {
  draftFingerprint: string;
  publishedFingerprint: string | null;
}): boolean {
  if (!input.publishedFingerprint) return true;
  return input.draftFingerprint !== input.publishedFingerprint;
}

export function isPublishedOpenOrderCanonicalSnapshot(snapshot: unknown): boolean {
  return canonicalMenuSourceFromSnapshot(snapshot) === "open_order";
}

export function resolveMenuBuilderPublishStatus(input: {
  hasPublishedOpenOrderMenu: boolean;
  hasUnpublishedChanges: boolean;
  validationReady: boolean;
  blockerCount: number;
}): MenuBuilderPublishStatusView {
  const blockerCount = input.blockerCount;

  if (!input.validationReady) {
    return {
      kind: "needs_attention",
      headline: "Fix menu issues before publishing",
      detail:
        blockerCount === 1
          ? "There is 1 issue to fix before customers can order from this menu."
          : `There are ${blockerCount} issues to fix before customers can order from this menu.`,
      blockerCount,
    };
  }

  if (!input.hasPublishedOpenOrderMenu) {
    return {
      kind: "never_published",
      headline: "Ready to publish",
      detail:
        "Your draft looks good. Publish to make it live for customers. Until then, customers cannot order from this menu.",
      blockerCount: 0,
    };
  }

  if (input.hasUnpublishedChanges) {
    return {
      kind: "unpublished",
      headline: "You have unpublished changes",
      detail:
        "Customers are seeing the last published version until you publish changes.",
      blockerCount: 0,
    };
  }

  return {
    kind: "live",
    headline: "All changes are live",
    detail: "Customers are ordering from your published menu.",
    blockerCount: 0,
  };
}

export function publishConfirmMessage(input: {
  hasPublishedOpenOrderMenu: boolean;
  hasUnpublishedChanges: boolean;
}): string {
  if (!input.hasPublishedOpenOrderMenu) {
    return "Publish your menu to make it live for customers?";
  }
  if (input.hasUnpublishedChanges) {
    return "Publish your menu changes? Customers will see the updated menu after you publish.";
  }
  return "Publish menu again?";
}
