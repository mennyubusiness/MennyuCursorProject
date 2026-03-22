/**
 * Deliverect-first menu import — domain layer (canonical shape, validation, pipeline).
 * Normalization lives under @/integrations/deliverect/menu.
 */

export {
  mennyuCanonicalMenuSchema,
  mennyuCanonicalCategorySchema,
  mennyuCanonicalProductSchema,
  mennyuCanonicalModifierGroupSchema,
  mennyuCanonicalModifierOptionSchema,
  deliverectMenuImportMetaSchema,
  canonicalMoneyCentsSchema,
  type MennyuCanonicalMenu,
  type MennyuCanonicalCategory,
  type MennyuCanonicalProduct,
  type MennyuCanonicalModifierGroup,
  type MennyuCanonicalModifierOption,
  type DeliverectMenuImportMeta,
  type CanonicalMoneyCents,
} from "./canonical.schema";

export {
  type MenuImportIssueKind,
  type MenuImportIssueSeverity,
  type MenuImportIssueRecord,
  isBlockingIssue,
  partitionIssuesBySeverity,
  hasBlockingIssues,
} from "./issues";

export { validateCanonicalMenu, type ValidateCanonicalMenuResult } from "./validate";
