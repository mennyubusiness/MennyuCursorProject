/**
 * Open Order menu import — domain layer (canonical shape, validation, pipeline).
 * Provider normalizers live under integrations / lib/integrations.
 *
 * Prefer integration-neutral helpers from `./canonical-identity` and
 * `./menu-source-provider` in generic menu code. Legacy Deliverect field names remain
 * in the JSON snapshot and Prisma columns until a later migration phase.
 */

export {
  openOrderCanonicalMenuSchema,
  openOrderCanonicalCategorySchema,
  openOrderCanonicalProductSchema,
  openOrderCanonicalModifierGroupSchema,
  openOrderCanonicalModifierOptionSchema,
  menuSourceMetaSchema,
  mennyuCanonicalMenuSchema,
  mennyuCanonicalCategorySchema,
  mennyuCanonicalProductSchema,
  mennyuCanonicalModifierGroupSchema,
  mennyuCanonicalModifierOptionSchema,
  deliverectMenuImportMetaSchema,
  canonicalMoneyCentsSchema,
  type OpenOrderCanonicalMenu,
  type OpenOrderCanonicalCategory,
  type OpenOrderCanonicalProduct,
  type OpenOrderCanonicalModifierGroup,
  type OpenOrderCanonicalModifierOption,
  type MennyuCanonicalMenu,
  type MennyuCanonicalCategory,
  type MennyuCanonicalProduct,
  type MennyuCanonicalModifierGroup,
  type MennyuCanonicalModifierOption,
  type MenuSourceMeta,
  type DeliverectMenuImportMeta,
  type CanonicalMoneyCents,
} from "./canonical.schema";

export {
  productExternalId,
  productSourceParentExternalId,
  isVariantLeafProduct,
  variantParentPlu,
  variantParentName,
  menuSourceMeta,
  resolveMenuSourceProvider,
  menuItemSourceEntityId,
  menuItemSourceCategoryId,
  isVariantLeafMenuItem,
  variantParentPluFromItem,
  variantParentNameFromItem,
  modifierGroupSourceEntityId,
  modifierOptionSourceEntityId,
  jobSourceLocationId,
} from "./canonical-identity";

export {
  menuSourceProvider,
  menuSourceProviderLabel,
  type MenuSourceProvider,
} from "./menu-source-provider";

export {
  menuImportJobLocationWrite,
  type MenuImportJobLocationWrite,
} from "./menu-import-job-location";

export {
  diagnoseMenuProviderConsistency,
  type MenuProviderConsistencyIssue,
  type MenuProviderConsistencyCode,
} from "./menu-provider-consistency";

export {
  computeCustomerMenuBrowseExcludedProductIds,
  explainCustomerMenuBrowseExclusions,
  type CustomerMenuBrowseExclusion,
  type CustomerMenuBrowseExclusionReason,
} from "./customer-menu-browse";

export {
  type MenuImportIssueKind,
  type MenuImportIssueSeverity,
  type MenuImportIssueRecord,
  isBlockingIssue,
  partitionIssuesBySeverity,
  hasBlockingIssues,
} from "./issues";

export { validateCanonicalMenu, type ValidateCanonicalMenuResult } from "./validate";

export { diffCanonicalMenus, type CanonicalMenuDiff } from "./canonical-diff";
