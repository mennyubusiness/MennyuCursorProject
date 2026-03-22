import type { MennyuCanonicalMenu } from "@/domain/menu-import/canonical.schema";
import {
  hasBlockingIssues,
  type MenuImportIssueRecord,
} from "@/domain/menu-import/issues";
import { validateCanonicalMenu } from "@/domain/menu-import/validate";
import {
  normalizeDeliverectMenuToCanonical,
  type NormalizeDeliverectMenuInput,
} from "@/integrations/deliverect/menu/normalize";

export interface Phase1aMenuImportResult {
  menu: MennyuCanonicalMenu | null;
  normalizationIssues: MenuImportIssueRecord[];
  validationIssues: MenuImportIssueRecord[];
  allIssues: MenuImportIssueRecord[];
  /** True when a canonical menu exists and there are no blocking issues anywhere. */
  ok: boolean;
}

/**
 * Phase 1A entrypoint: Deliverect raw JSON → canonical → validate. No DB, no publish.
 */
export function runPhase1aDeliverectMenuImport(
  input: NormalizeDeliverectMenuInput
): Phase1aMenuImportResult {
  const { menu, issues: normalizationIssues } = normalizeDeliverectMenuToCanonical(input);

  if (!menu) {
    return {
      menu: null,
      normalizationIssues,
      validationIssues: [],
      allIssues: normalizationIssues,
      ok: false,
    };
  }

  const { menu: validatedMenu, issues: validationIssues, ok: zodOk } = validateCanonicalMenu(menu);

  const allIssues = [...normalizationIssues, ...validationIssues];
  const ok = zodOk && validatedMenu !== null && !hasBlockingIssues(normalizationIssues);

  return {
    menu: validatedMenu,
    normalizationIssues,
    validationIssues,
    allIssues,
    ok,
  };
}
