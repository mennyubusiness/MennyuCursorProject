/**
 * Import pipeline issues (normalization + validation). No DB coupling — safe to persist later as MenuImportIssue rows.
 */

/** Where the issue originated in the pipeline */
export type MenuImportIssueKind = "normalization" | "validation";

/**
 * - blocking: publish must not proceed until fixed or waived
 * - warning: allowed to publish with review (product policy)
 * - info: diagnostic only
 */
export type MenuImportIssueSeverity = "blocking" | "warning" | "info";

export interface MenuImportIssueRecord {
  kind: MenuImportIssueKind;
  severity: MenuImportIssueSeverity;
  /** Stable machine code e.g. DUPLICATE_PRODUCT_ID, ORPHAN_MODIFIER_GROUP_REF */
  code: string;
  message: string;
  /** JSON Pointer–style path into canonical tree, when applicable */
  entityPath?: string;
  /** Deliverect-side id from raw payload or canonical entity */
  deliverectId?: string;
  /** Small structured context (not raw Deliverect blobs) */
  details?: Record<string, unknown>;
}

export function isBlockingIssue(i: MenuImportIssueRecord): boolean {
  return i.severity === "blocking";
}

export function partitionIssuesBySeverity(issues: MenuImportIssueRecord[]): {
  blocking: MenuImportIssueRecord[];
  warning: MenuImportIssueRecord[];
  info: MenuImportIssueRecord[];
} {
  return {
    blocking: issues.filter((i) => i.severity === "blocking"),
    warning: issues.filter((i) => i.severity === "warning"),
    info: issues.filter((i) => i.severity === "info"),
  };
}

export function hasBlockingIssues(issues: MenuImportIssueRecord[]): boolean {
  return issues.some(isBlockingIssue);
}
