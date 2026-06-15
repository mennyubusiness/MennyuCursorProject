/**
 * Deliverect menu mapping health for a vendor — lightweight, no live Deliverect API calls.
 * Aligns with {@link validateForSubmission}, {@link validateDeliverectPayload}, and transform assumptions.
 */
import "server-only";

import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import {
  isTopLevelDeliverectVariantGroupModifierGroup,
  maxSubItemsChainVariantStepsForProductShape,
} from "@/lib/deliverect-subitem-nesting";
import {
  getOperationalMenuItemIdsForVendor,
  getOperationalModifierOptionIdsForVendor,
} from "@/services/menu-active-scope.service";

export type DeliverectMenuIntegritySeverity = "critical" | "warning" | "info";

export type DeliverectMenuIntegrityFindingType =
  | "channel_not_configured"
  | "location_not_configured"
  | "missing_product_plu"
  | "missing_modifier_plu"
  | "inconsistent_variant_parent_without_plu"
  | "duplicate_product_plu"
  | "duplicate_modifier_plu"
  | "deliverect_subitems_chain_depth_risk"
  | "stale_canonical_variant_mapping"
  | "missing_external_product_id"
  | "missing_external_modifier_id"
  | "no_published_menu_baseline"
  | "deliverect_plu_reused_across_product_and_modifier";

export interface DeliverectMenuIntegrityFinding {
  severity: DeliverectMenuIntegritySeverity;
  type: DeliverectMenuIntegrityFindingType;
  message: string;
  suggestedFix?: string;
  menuItemId?: string;
  menuItemName?: string;
  modifierOptionId?: string;
  modifierOptionName?: string;
  modifierGroupName?: string;
  /** Duplicate or ambiguous PLU value (trimmed). */
  plu?: string;
}

export interface DeliverectMenuIntegrityReport {
  vendorId: string;
  vendorName: string | null;
  evaluatedAt: string;
  /** Vendor has a non-empty Deliverect channel link (intended POS path). */
  deliverectRouted: boolean;
  /** No critical findings and channel configured — safe baseline for routing checks. */
  deliverectReady: boolean;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  findings: DeliverectMenuIntegrityFinding[];
}

function finding(
  f: Omit<DeliverectMenuIntegrityFinding, "severity"> & { severity?: DeliverectMenuIntegritySeverity }
): DeliverectMenuIntegrityFinding {
  const severity = f.severity ?? "warning";
  const { severity: _s, ...rest } = f;
  return { ...rest, severity };
}

/** Exported for unit tests — detect duplicate trimmed PLUs in parallel arrays. */
export function findDuplicatePluGroups(
  entries: Array<{ key: string | null | undefined; id: string }>
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const e of entries) {
    const k = e.key?.trim();
    if (!k) continue;
    const list = map.get(k) ?? [];
    list.push(e.id);
    map.set(k, list);
  }
  const out = new Map<string, string[]>();
  for (const [k, ids] of map) {
    if (ids.length > 1) out.set(k, ids);
  }
  return out;
}

/** Deliverect variant parent placeholder rows use a sentinel PLU suffix — not sellable product lines. */
export function isDeliverectVariantParentPlaceholderPlu(plu: string | null | undefined): boolean {
  const trimmed = plu?.trim();
  if (!trimmed) return false;
  return trimmed.includes("###PRNT");
}

export type ProductPluIntegrityRow = {
  id: string;
  name: string;
  deliverectPlu: string | null;
};

/**
 * Duplicate product PLUs among operational sellable rows only.
 * Retired/historical MenuItem rows and variant parent placeholders are excluded.
 */
export function findDuplicateOperationalProductPlus(
  items: ProductPluIntegrityRow[],
  operationalIds: Set<string>
): Map<string, string[]> {
  const entries = items
    .filter((it) => operationalIds.has(it.id))
    .filter((it) => !isDeliverectVariantParentPlaceholderPlu(it.deliverectPlu))
    .map((it) => ({ key: it.deliverectPlu, id: it.id }));
  return findDuplicatePluGroups(entries);
}

export type ModifierPluIntegrityRow = {
  optionId: string;
  groupId: string;
  groupName: string;
  plu: string | null;
  isOperational: boolean;
};

/**
 * Duplicate modifier PLUs scoped to the same modifier group and operational options only.
 * Reuse of the same PLU across different groups (e.g. TOMAT on multiple items) is valid.
 */
export function findDuplicateModifierPlusInSameGroup(
  rows: ModifierPluIntegrityRow[]
): Array<{ groupId: string; groupName: string; plu: string; optionIds: string[] }> {
  const byGroupPlu = new Map<string, { groupId: string; groupName: string; plu: string; optionIds: string[] }>();

  for (const row of rows) {
    if (!row.isOperational) continue;
    const plu = row.plu?.trim();
    if (!plu) continue;
    const key = `${row.groupId}\0${plu}`;
    const existing = byGroupPlu.get(key);
    if (existing) {
      existing.optionIds.push(row.optionId);
    } else {
      byGroupPlu.set(key, {
        groupId: row.groupId,
        groupName: row.groupName,
        plu,
        optionIds: [row.optionId],
      });
    }
  }

  return [...byGroupPlu.values()].filter((entry) => entry.optionIds.length > 1);
}

/** PLUs shared between operational products and operational modifiers — usually intentional in Deliverect. */
export function findProductModifierPluOverlap(
  productPlus: Set<string>,
  modifierPlus: Set<string>
): string[] {
  const overlap: string[] = [];
  for (const plu of productPlus) {
    if (modifierPlus.has(plu)) overlap.push(plu);
  }
  return overlap.sort();
}

export function collectOperationalProductPlus(items: ProductPluIntegrityRow[], operationalIds: Set<string>): Set<string> {
  const plus = new Set<string>();
  for (const it of items) {
    if (!operationalIds.has(it.id)) continue;
    if (isDeliverectVariantParentPlaceholderPlu(it.deliverectPlu)) continue;
    const plu = it.deliverectPlu?.trim();
    if (plu) plus.add(plu);
  }
  return plus;
}

export function collectOperationalModifierPlus(rows: ModifierPluIntegrityRow[]): Set<string> {
  const plus = new Set<string>();
  for (const row of rows) {
    if (!row.isOperational) continue;
    const plu = row.plu?.trim();
    if (plu) plus.add(plu);
  }
  return plus;
}

/**
 * Evaluate mapping health for one vendor. O(n) over menu items and modifier options.
 * Does not call Deliverect APIs.
 */
export async function evaluateDeliverectMenuIntegrityForVendor(
  vendorId: string
): Promise<DeliverectMenuIntegrityReport> {
  const evaluatedAt = new Date().toISOString();
  const findings: DeliverectMenuIntegrityFinding[] = [];

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      deliverectChannelLinkId: true,
      deliverectLocationId: true,
    },
  });

  if (!vendor) {
    return {
      vendorId,
      vendorName: null,
      evaluatedAt,
      deliverectRouted: false,
      deliverectReady: false,
      criticalCount: 1,
      warningCount: 0,
      infoCount: 0,
      findings: [
        finding({
          severity: "critical",
          type: "channel_not_configured",
          message: "Vendor not found.",
          suggestedFix: "Verify the vendor id.",
        }),
      ],
    };
  }

  const channelOk = Boolean(vendor.deliverectChannelLinkId?.trim());
  const deliverectRouted = channelOk;

  if (!channelOk) {
    findings.push(
      finding({
        severity: "critical",
        type: "channel_not_configured",
        message: "No Deliverect channel link ID — orders cannot be routed to POS.",
        suggestedFix: "Set Vendor.deliverectChannelLinkId for this vendor.",
      })
    );
  } else if (!vendor.deliverectLocationId?.trim()) {
    findings.push(
      finding({
        severity: "warning",
        type: "location_not_configured",
        message: "Deliverect location ID is empty — some channel configs require Vendor.deliverectLocationId on the order.",
        suggestedFix: "Set Vendor.deliverectLocationId if your Deliverect account expects a store/location id.",
      })
    );
  }

  const publishedRow = await prisma.menuVersion.findFirst({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, canonicalSnapshot: true },
  });
  if (!publishedRow) {
    findings.push(
      finding({
        severity: "warning",
        type: "no_published_menu_baseline",
        message:
          "No published MenuVersion — operational winners and PLU checks use legacy fallback; publish the menu for definitive mapping health.",
        suggestedFix: "Publish a menu import draft so operational scope matches the canonical snapshot.",
      })
    );
  }

  const operationalIds = await getOperationalMenuItemIdsForVendor(vendorId);
  const operationalModifierOptionIds = await getOperationalModifierOptionIdsForVendor(vendorId);

  const items = await prisma.menuItem.findMany({
    where: { vendorId },
    select: {
      id: true,
      name: true,
      isAvailable: true,
      deliverectPlu: true,
      deliverectProductId: true,
      deliverectVariantParentPlu: true,
      modifierGroups: {
        select: {
          modifierGroup: {
            select: {
              id: true,
              name: true,
              deliverectIsVariantGroup: true,
              parentModifierOptionId: true,
              options: {
                select: {
                  id: true,
                  name: true,
                  isAvailable: true,
                  deliverectModifierPlu: true,
                  deliverectModifierId: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const productPluRows: ProductPluIntegrityRow[] = items.map((it) => ({
    id: it.id,
    name: it.name,
    deliverectPlu: it.deliverectPlu,
  }));

  for (const [plu, ids] of findDuplicateOperationalProductPlus(productPluRows, operationalIds)) {
    const named = items.filter((i) => ids.includes(i.id)).map((i) => i.name);
    findings.push(
      finding({
        severity: "warning",
        type: "duplicate_product_plu",
        message: `Duplicate deliverectPlu "${plu}" on ${ids.length} operational menu rows (${named.slice(0, 3).join(", ")}${named.length > 3 ? "…" : ""}).`,
        suggestedFix:
          "Two active sellable products share the same POS PLU — kitchen routing may be ambiguous. Republish or retire the extra row.",
        plu,
      })
    );
  }

  const modifierPluRows: ModifierPluIntegrityRow[] = [];
  for (const it of items) {
    for (const link of it.modifierGroups) {
      for (const opt of link.modifierGroup.options) {
        modifierPluRows.push({
          optionId: opt.id,
          groupId: link.modifierGroup.id,
          groupName: link.modifierGroup.name,
          plu: opt.deliverectModifierPlu,
          isOperational: operationalModifierOptionIds.has(opt.id),
        });
      }
    }
  }

  for (const dup of findDuplicateModifierPlusInSameGroup(modifierPluRows)) {
    findings.push(
      finding({
        severity: "warning",
        type: "duplicate_modifier_plu",
        message: `Duplicate deliverectModifierPlu "${dup.plu}" on ${dup.optionIds.length} options in modifier group “${dup.groupName}”.`,
        suggestedFix:
          "Two active options in the same modifier group share a PLU — outbound modifier routing may be ambiguous within that group.",
        plu: dup.plu,
        modifierGroupName: dup.groupName,
      })
    );
  }

  const productPlus = collectOperationalProductPlus(productPluRows, operationalIds);
  const modifierPlus = collectOperationalModifierPlus(modifierPluRows);
  for (const plu of findProductModifierPluOverlap(productPlus, modifierPlus)) {
    findings.push(
      finding({
        severity: "info",
        type: "deliverect_plu_reused_across_product_and_modifier",
        message: `PLU "${plu}" is used on both an operational product and modifier option(s). Deliverect often reuses PLUs this way; routing is usually unambiguous.`,
        plu,
      })
    );
  }

  const relevantGroupIds = new Set<string>();
  const links = await prisma.menuItemModifierGroup.findMany({
    where: { menuItemId: { in: [...operationalIds] } },
    select: { modifierGroupId: true },
  });
  for (const l of links) relevantGroupIds.add(l.modifierGroupId);

  const optionIdsNeedingPlu = new Set<string>();
  for (const it of items) {
    if (!operationalIds.has(it.id) || !it.isAvailable) continue;

    const parentPlu = it.deliverectVariantParentPlu?.trim();
    const leafPlu = it.deliverectPlu?.trim();
    if (!leafPlu) {
      if (parentPlu) {
        findings.push(
          finding({
            severity: "critical",
            type: "inconsistent_variant_parent_without_plu",
            message: `“${it.name}” has a variant parent PLU but no sellable PLU — outbound orders cannot be built.`,
            suggestedFix: "Set deliverectPlu on the variation row, or clear variant parent if this row is not a leaf.",
            menuItemId: it.id,
            menuItemName: it.name,
          })
        );
      } else {
        findings.push(
          finding({
            severity: "critical",
            type: "missing_product_plu",
            message: `Operational menu item “${it.name}” has no deliverectPlu — same failure as pre-submit validation (missing channel PLU).`,
            suggestedFix: "Import or set the POS PLU on this MenuItem.",
            menuItemId: it.id,
            menuItemName: it.name,
          })
        );
      }
    } else if (!it.deliverectProductId?.trim()) {
      findings.push(
        finding({
          severity: "warning",
          type: "missing_external_product_id",
          message: `“${it.name}” has a PLU but no deliverectProductId — optional, but external id helps POS reconciliation.`,
          suggestedFix: "Set deliverectProductId from Deliverect when available.",
          menuItemId: it.id,
          menuItemName: it.name,
        })
      );
    }

    let variantGroupCount = 0;
    for (const link of it.modifierGroups) {
      if (isTopLevelDeliverectVariantGroupModifierGroup(link.modifierGroup)) variantGroupCount++;
      if (!relevantGroupIds.has(link.modifierGroup.id)) continue;
      for (const opt of link.modifierGroup.options) {
        if (opt.isAvailable) optionIdsNeedingPlu.add(opt.id);
      }
    }

    const maxChain = maxSubItemsChainVariantStepsForProductShape(Boolean(parentPlu));
    if (variantGroupCount > maxChain) {
      findings.push(
        finding({
          severity: "warning",
          type: "deliverect_subitems_chain_depth_risk",
          message: `“${it.name}” has ${variantGroupCount} top-level Deliverect variant group(s) on the main item; online orders can only nest ${maxChain} in the subItems chain for this product shape (Deliverect limit — not a cap on toppings).`,
          suggestedFix:
            "Reduce top-level variant groups used as size/style chains, or split the product in Deliverect. Groups nested under another modifier do not count toward this limit.",
          menuItemId: it.id,
          menuItemName: it.name,
        })
      );
    }
  }

  const optionsToCheck = await prisma.modifierOption.findMany({
    where: { id: { in: [...optionIdsNeedingPlu] } },
    include: {
      modifierGroup: { select: { id: true, name: true } },
    },
  });

  for (const opt of optionsToCheck) {
    if (!opt.deliverectModifierPlu?.trim()) {
      findings.push(
        finding({
          severity: "critical",
          type: "missing_modifier_plu",
          message: `Modifier “${opt.name}” (${opt.modifierGroup.name}) has no deliverectModifierPlu — cannot serialize modifiers on outbound orders.`,
          suggestedFix: "Set the POS modifier PLU on ModifierOption.",
          modifierOptionId: opt.id,
          modifierOptionName: opt.name,
          modifierGroupName: opt.modifierGroup.name,
        })
      );
    } else if (!opt.deliverectModifierId?.trim()) {
      findings.push(
        finding({
          severity: "warning",
          type: "missing_external_modifier_id",
          message: `Modifier “${opt.name}” has a PLU but no deliverectModifierId — optional external reference only.`,
          suggestedFix: "Set deliverectModifierId from Deliverect when helpful for debugging.",
          modifierOptionId: opt.id,
          modifierOptionName: opt.name,
          modifierGroupName: opt.modifierGroup.name,
        })
      );
    }
  }

  if (publishedRow?.canonicalSnapshot) {
    const parsed = mennyuCanonicalMenuSchema.safeParse(publishedRow.canonicalSnapshot);
    if (parsed.success) {
      const byProductId = new Map(parsed.data.products.map((p) => [p.deliverectId, p]));
      for (const it of items) {
        if (!operationalIds.has(it.id)) continue;
        const pid = it.deliverectProductId?.trim();
        if (!pid) continue;
        const canon = byProductId.get(pid);
        if (canon?.deliverectVariantParentPlu && !it.deliverectVariantParentPlu?.trim()) {
          findings.push(
            finding({
              severity: "warning",
              type: "stale_canonical_variant_mapping",
              message: `Published menu expects variant parent PLU for “${it.name}”, but the live row is missing deliverectVariantParentPlu (matches pre-submit MENU_REPUBLISH_REQUIRED).`,
              suggestedFix: "Republish the menu import or align the live MenuItem with the published canonical.",
              menuItemId: it.id,
              menuItemName: it.name,
            })
          );
        }
      }
    }
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const warningCount = findings.filter((f) => f.severity === "warning").length;
  const infoCount = findings.filter((f) => f.severity === "info").length;
  const deliverectReady = channelOk && criticalCount === 0;

  return {
    vendorId,
    vendorName: vendor.name,
    evaluatedAt,
    deliverectRouted,
    deliverectReady,
    criticalCount,
    warningCount,
    infoCount,
    findings,
  };
}
