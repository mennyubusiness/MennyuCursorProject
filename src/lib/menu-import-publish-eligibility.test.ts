import { describe, expect, it } from "vitest";
import {
  MenuImportIssueSeverity,
  MenuImportJobStatus,
  MenuVersionState,
} from "@prisma/client";
import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import {
  evaluateMenuImportPublishEligibility,
  noPendingMenuPublishEligibility,
} from "@/lib/menu-import-publish-eligibility";

function minimalCanonical(overrides: Partial<MennyuCanonicalMenu> = {}): MennyuCanonicalMenu {
  return {
    schemaVersion: 1,
    vendorId: "vendor_1",
    deliverect: { sourcePayloadKind: "deliverect_menu_api_v1" },
    categories: [],
    modifierGroupDefinitions: [],
    products: [
      {
        deliverectId: "prod_1",
        plu: "PLU-1",
        name: "Burger",
        priceCents: 1200,
        isAvailable: true,
        sortOrder: 0,
        modifierGroupDeliverectIds: [],
      },
    ],
    ...overrides,
  };
}

describe("evaluateMenuImportPublishEligibility", () => {
  const draftVersion = {
    state: MenuVersionState.draft,
    canonicalSnapshot: minimalCanonical(),
  };

  it("returns live state for succeeded published jobs without warnings", () => {
    const result = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.succeeded,
      draftVersionId: "mv_1",
      draftVersion: { state: MenuVersionState.published, canonicalSnapshot: minimalCanonical() },
      issues: [],
    });

    expect(result.canPublish).toBe(false);
    expect(result.displayState).toBe("live");
    expect(result.showPublishWarning).toBe(false);
    expect(result.blockers).toHaveLength(0);
    expect(result.infoMessage).toMatch(/live/i);
    expect(result.reasons.join(" ")).not.toMatch(/awaiting_review|published|succeeded|draft state/i);
  });

  it("does not expose internal workflow language for published menus", () => {
    const result = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.succeeded,
      draftVersionId: "mv_1",
      draftVersion: { state: MenuVersionState.published, canonicalSnapshot: minimalCanonical() },
      issues: [],
    });

    const combined = [...result.blockers, ...result.reasons, result.infoMessage ?? ""].join(" ");
    expect(combined).not.toMatch(/awaiting_review|succeeded|draft state|Job status/i);
  });

  it("allows publish when draft is awaiting review with no blockers", () => {
    const result = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.awaiting_review,
      draftVersionId: "mv_draft",
      draftVersion,
      issues: [],
    });

    expect(result.canPublish).toBe(true);
    expect(result.displayState).toBe("ready");
    expect(result.showPublishWarning).toBe(false);
    expect(result.infoMessage).toMatch(/Review and publish/i);
  });

  it("shows friendly blockers for empty menus and critical issues", () => {
    const emptyMenu = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.awaiting_review,
      draftVersionId: "mv_draft",
      draftVersion: {
        state: MenuVersionState.draft,
        canonicalSnapshot: minimalCanonical({ products: [] }),
      },
      issues: [],
    });
    expect(emptyMenu.showPublishWarning).toBe(true);
    expect(emptyMenu.blockers.some((line) => /menu item/i.test(line))).toBe(true);

    const withIssues = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.awaiting_review,
      draftVersionId: "mv_draft",
      draftVersion,
      issues: [{ severity: MenuImportIssueSeverity.blocking, waived: false }],
    });
    expect(withIssues.showPublishWarning).toBe(true);
    expect(withIssues.blockers.some((line) => /critical issue/i.test(line))).toBe(true);
  });

  it("shows failed copy for failed jobs", () => {
    const result = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.failed,
      draftVersionId: "mv_draft",
      draftVersion,
      issues: [],
    });

    expect(result.displayState).toBe("failed");
    expect(result.showPublishWarning).toBe(true);
    expect(result.blockers[0]).toMatch(/failed/i);
  });

  it("shows processing copy for in-flight jobs without warnings", () => {
    const result = evaluateMenuImportPublishEligibility({
      status: MenuImportJobStatus.validating,
      draftVersionId: "mv_draft",
      draftVersion,
      issues: [],
    });

    expect(result.displayState).toBe("processing");
    expect(result.showPublishWarning).toBe(false);
    expect(result.infoMessage).toMatch(/processed/i);
  });
});

describe("noPendingMenuPublishEligibility", () => {
  it("returns calm no-pending copy without warnings", () => {
    const result = noPendingMenuPublishEligibility();
    expect(result.showPublishWarning).toBe(false);
    expect(result.infoMessage).toMatch(/No menu changes/i);
  });
});
