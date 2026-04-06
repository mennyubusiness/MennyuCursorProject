/**
 * Deliverect menu mapping health for a vendor — lightweight, no live Deliverect API calls.
 * Aligns with {@link validateForSubmission}, {@link validateDeliverectPayload}, and transform assumptions.
 */
import "server-only";

import { MenuVersionState } from "@prisma/client";
import { mennyuCanonicalMenuSchema } from "@/domain/menu-import/canonical.schema";
import { prisma } from "@/lib/db";
import { maxDeliverectVariantGroupSelectionsForMenuItem } from "@/lib/deliverect-subitem-nesting";
import { getOperationalMenuItemIdsForVendor } from "@/services/menu-active-scope.service";

export type DeliverectMenuIntegritySeverity = "critical" | "warning" | "info";

export type DeliverectMenuIntegrityFindingType =
  | "channel_not_configured"
  | "location_not_configured"
  | "missing_product_plu"
  | "missing_modifier_plu"
  | "inconsistent_variant_parent_without_plu"
  | "duplicate_product_plu"
  | "duplicate_modifier_plu"
  | "variant_nesting_depth_risk"
  | "stale_canonical_variant_mapping"
  | "missing_external_product_id"
  | "missing_external_modifier_id"
  | "no_published_menu_baseline";

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

  const productPluEntries = items.map((it) => ({ key: it.deliverectPlu, id: it.id }));
  for (const [plu, ids] of findDuplicatePluGroups(productPluEntries)) {
    const named = items.filter((i) => ids.includes(i.id)).map((i) => i.name);
    findings.push(
      finding({
        severity: "warning",
        type: "duplicate_product_plu",
        message: `Duplicate deliverectPlu "${plu}" on ${ids.length} menu rows (${named.slice(0, 3).join(", ")}${named.length > 3 ? "…" : ""}).`,
        suggestedFix: "Ensure only one operational row per PLU; retire duplicates in the menu publisher.",
        plu,
      })
    );
  }

  const modifierPluEntries: Array<{ key: string | null | undefined; id: string }> = [];
  for (const it of items) {
    for (const link of it.modifierGroups) {
      for (const opt of link.modifierGroup.options) {
        modifierPluEntries.push({ key: opt.deliverectModifierPlu, id: opt.id });
      }
    }
  }
  for (const [plu, ids] of findDuplicatePluGroups(modifierPluEntries)) {
    findings.push(
      finding({
        severity: "warning",
        type: "duplicate_modifier_plu",
        message: `Duplicate deliverectModifierPlu "${plu}" on ${ids.length} modifier option rows.`,
        suggestedFix: "Deduplicate modifier options or use distinct PLUs per POS requirement.",
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
      if (link.modifierGroup.deliverectIsVariantGroup === true) variantGroupCount++;
      if (!relevantGroupIds.has(link.modifierGroup.id)) continue;
      for (const opt of link.modifierGroup.options) {
        if (opt.isAvailable) optionIdsNeedingPlu.add(opt.id);
      }
    }

    const maxVg = maxDeliverectVariantGroupSelectionsForMenuItem(Boolean(parentPlu));
    if (variantGroupCount > maxVg) {
      findings.push(
        finding({
          severity: "warning",
          type: "variant_nesting_depth_risk",
          message: `“${it.name}” has ${variantGroupCount} variant group(s); Deliverect allows at most ${maxVg} for this product shape — orders with all steps may be rejected.`,
          suggestedFix: "Reduce nested variant groups or split the product in Deliverect / Mennyu.",
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
