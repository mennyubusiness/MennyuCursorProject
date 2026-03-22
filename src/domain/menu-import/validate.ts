import { z } from "zod";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";
import {
  type MenuImportIssueRecord,
  partitionIssuesBySeverity,
} from "@/domain/menu-import/issues";

export interface ValidateCanonicalMenuResult {
  ok: boolean;
  menu: MennyuCanonicalMenu | null;
  issues: MenuImportIssueRecord[];
}

/**
 * Structural + cross-reference checks on canonical menu. Maps Zod failures to **blocking** validation issues;
 * adds non-Zod policy checks as warning/info.
 */
export function validateCanonicalMenu(menu: unknown): ValidateCanonicalMenuResult {
  const parsed = mennyuCanonicalMenuSchema.safeParse(menu);
  if (!parsed.success) {
    const issues = zodErrorToValidationIssues(parsed.error);
    return { ok: false, menu: null, issues };
  }

  const m = parsed.data;
  const extra = collectPolicyIssues(m);
  const { blocking } = partitionIssuesBySeverity(extra);

  return {
    ok: blocking.length === 0,
    menu: m,
    issues: extra,
  };
}

function zodErrorToValidationIssues(err: z.ZodError): MenuImportIssueRecord[] {
  return err.issues.map((issue) => ({
    kind: "validation" as const,
    severity: "blocking" as const,
    code: `ZOD_${issue.code}`,
    message: issue.message,
    entityPath: pathToPointer(issue.path),
    details: { received: issue.code === "invalid_type" ? (issue as { received?: string }).received : undefined },
  }));
}

function pathToPointer(path: (string | number)[]): string {
  if (path.length === 0) return "/";
  return `/${path.map((p) => String(p)).join("/")}`;
}

function collectPolicyIssues(m: MennyuCanonicalMenu): MenuImportIssueRecord[] {
  const issues: MenuImportIssueRecord[] = [];

  if (m.categories.length === 0 && m.products.length > 0) {
    issues.push({
      kind: "validation",
      severity: "info",
      code: "NO_CATEGORIES",
      message: "Menu has products but no categories; consider assigning categories in Deliverect for clearer grouping.",
      entityPath: "/categories",
    });
  }

  for (const p of m.products) {
    if (p.description != null && p.description.length > 2000) {
      issues.push({
        kind: "validation",
        severity: "warning",
        code: "LONG_DESCRIPTION",
        message: `Product "${p.name}" has a very long description (${p.description.length} chars).`,
        entityPath: `/products/${p.deliverectId}/description`,
        deliverectId: p.deliverectId,
        details: { length: p.description.length },
      });
    }

    if (p.imageUrl != null && p.imageUrl.trim() !== "") {
      try {
        // eslint-disable-next-line no-new -- side effect: validate URL
        new URL(p.imageUrl);
      } catch {
        issues.push({
          kind: "validation",
          severity: "warning",
          code: "INVALID_IMAGE_URL",
          message: `Product "${p.name}" imageUrl is not a valid absolute URL.`,
          deliverectId: p.deliverectId,
          entityPath: `/products/${p.deliverectId}/imageUrl`,
        });
      }
    }

  }

  return issues;
}
