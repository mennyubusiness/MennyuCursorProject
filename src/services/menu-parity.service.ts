/**
 * Menu parity: published MenuVersion canonical snapshot (source of truth) vs live MenuItem / ModifierGroup / ModifierOption
 * rows keyed by Deliverect ids. Detects drift that breaks snooze, cart, and order PLU mapping.
 */
import "server-only";
import { MenuVersionState } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "@/domain/menu-import/canonical.schema";

export type MenuParityIssueCode =
  | "NO_PUBLISHED_MENU_VERSION"
  | "CANONICAL_PARSE_FAILED"
  | "DUPLICATE_ACTIVE_DELIVERECT_PRODUCT_ID"
  | "DUPLICATE_ACTIVE_DELIVERECT_PLU"
  | "SNAPSHOT_PRODUCT_MISSING_ON_LIVE"
  | "LIVE_ACTIVE_PRODUCT_NOT_IN_SNAPSHOT"
  | "PRODUCT_PLU_MISMATCH"
  | "ACTIVE_MENU_ITEM_MISSING_DELIVERECT_PRODUCT_ID"
  | "SNAPSHOT_MODIFIER_GROUP_MISSING_ON_LIVE"
  | "SNAPSHOT_MODIFIER_OPTION_MISSING_ON_LIVE"
  | "LIVE_ACTIVE_MODIFIER_GROUP_NOT_IN_SNAPSHOT";

export type MenuParityIssue = {
  code: MenuParityIssueCode;
  message: string;
  /** Entity ids or Deliverect ids for debugging (no name-based matching). */
  refs?: string[];
};

export type MenuParityAuditResult = {
  ok: boolean;
  vendorId: string;
  publishedMenuVersionId: string | null;
  checkedAtIso: string;
  skippedReason?: "no_published_version";
  issues: MenuParityIssue[];
};

export type LiveMenuItemParityRow = {
  deliverectProductId: string | null;
  deliverectPlu: string | null;
  isAvailable: boolean;
};

export type LiveModifierOptionParityRow = {
  deliverectModifierId: string | null;
  isAvailable: boolean;
};

export type LiveModifierGroupParityRow = {
  deliverectModifierGroupId: string | null;
  isAvailable: boolean;
  options: LiveModifierOptionParityRow[];
};

/**
 * Pure comparison for tests and reuse. Caller supplies canonical menu + live rows for one vendor.
 */
export function analyzeMenuParity(
  canonical: MennyuCanonicalMenu,
  menuItems: LiveMenuItemParityRow[],
  modifierGroups: LiveModifierGroupParityRow[]
): MenuParityIssue[] {
  const issues: MenuParityIssue[] = [];

  const snapshotProductIds = new Set(canonical.products.map((p) => p.deliverectId));
  const snapshotGroupIds = new Set(canonical.modifierGroupDefinitions.map((g) => g.deliverectId));

  const activeItems = menuItems.filter((m) => m.isAvailable);
  const byProductId = new Map<string, number>();
  const byPlu = new Map<string, number>();
  for (const m of activeItems) {
    if (m.deliverectProductId) {
      byProductId.set(m.deliverectProductId, (byProductId.get(m.deliverectProductId) ?? 0) + 1);
    }
    if (m.deliverectPlu != null && m.deliverectPlu !== "") {
      byPlu.set(m.deliverectPlu, (byPlu.get(m.deliverectPlu) ?? 0) + 1);
    }
  }

  for (const [id, n] of byProductId) {
    if (n > 1) {
      issues.push({
        code: "DUPLICATE_ACTIVE_DELIVERECT_PRODUCT_ID",
        message: `Active MenuItem: duplicate deliverectProductId (${n} rows).`,
        refs: [id],
      });
    }
  }
  for (const [plu, n] of byPlu) {
    if (n > 1) {
      issues.push({
        code: "DUPLICATE_ACTIVE_DELIVERECT_PLU",
        message: `Active MenuItem: duplicate deliverectPlu (${n} rows).`,
        refs: [plu],
      });
    }
  }

  for (const m of activeItems) {
    if (!m.deliverectProductId) {
      issues.push({
        code: "ACTIVE_MENU_ITEM_MISSING_DELIVERECT_PRODUCT_ID",
        message: "Active MenuItem is missing deliverectProductId (cannot map orders/snooze).",
      });
    }
  }

  for (const p of canonical.products) {
    const count = byProductId.get(p.deliverectId) ?? 0;
    if (count === 0) {
      issues.push({
        code: "SNAPSHOT_PRODUCT_MISSING_ON_LIVE",
        message: `Published snapshot product not found on live MenuItem.`,
        refs: [p.deliverectId],
      });
    } else if (count === 1) {
      const live = activeItems.find((x) => x.deliverectProductId === p.deliverectId);
      if (live && p.plu != null && p.plu !== "" && live.deliverectPlu !== p.plu) {
        issues.push({
          code: "PRODUCT_PLU_MISMATCH",
          message: `MenuItem deliverectPlu does not match canonical plu for product.`,
          refs: [p.deliverectId],
        });
      }
    }
  }

  const seenExtraProduct = new Set<string>();
  for (const m of activeItems) {
    if (
      m.deliverectProductId &&
      !snapshotProductIds.has(m.deliverectProductId) &&
      !seenExtraProduct.has(m.deliverectProductId)
    ) {
      seenExtraProduct.add(m.deliverectProductId);
      issues.push({
        code: "LIVE_ACTIVE_PRODUCT_NOT_IN_SNAPSHOT",
        message: "Active MenuItem deliverectProductId is not in the published canonical menu.",
        refs: [m.deliverectProductId],
      });
    }
  }

  const groupsByDeliverectId = new Map<string, LiveModifierGroupParityRow>();
  for (const g of modifierGroups) {
    if (g.deliverectModifierGroupId) {
      groupsByDeliverectId.set(g.deliverectModifierGroupId, g);
    }
  }

  for (const gdef of canonical.modifierGroupDefinitions) {
    const liveG = groupsByDeliverectId.get(gdef.deliverectId);
    if (!liveG) {
      issues.push({
        code: "SNAPSHOT_MODIFIER_GROUP_MISSING_ON_LIVE",
        message: `Published modifier group not found on live.`,
        refs: [gdef.deliverectId],
      });
      continue;
    }
    const liveOptionIds = new Set(
      liveG.options.filter((o) => o.deliverectModifierId).map((o) => o.deliverectModifierId!)
    );
    for (const o of gdef.options) {
      if (!liveOptionIds.has(o.deliverectId)) {
        issues.push({
          code: "SNAPSHOT_MODIFIER_OPTION_MISSING_ON_LIVE",
          message: `Published modifier option not found on live (or inactive).`,
          refs: [gdef.deliverectId, o.deliverectId],
        });
      }
    }
  }

  for (const g of modifierGroups) {
    if (g.isAvailable && g.deliverectModifierGroupId && !snapshotGroupIds.has(g.deliverectModifierGroupId)) {
      issues.push({
        code: "LIVE_ACTIVE_MODIFIER_GROUP_NOT_IN_SNAPSHOT",
        message: "Active ModifierGroup deliverectModifierGroupId is not in published canonical menu.",
        refs: [g.deliverectModifierGroupId],
      });
    }
  }

  return issues;
}

/**
 * Load current published MenuVersion for vendor and compare to live rows. Structured result for UI and CI.
 */
export async function runMenuParityAudit(vendorId: string): Promise<MenuParityAuditResult> {
  const checkedAtIso = new Date().toISOString();

  const published = await prisma.menuVersion.findFirst({
    where: { vendorId, state: MenuVersionState.published },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, canonicalSnapshot: true },
  });

  if (!published) {
    return {
      ok: true,
      vendorId,
      publishedMenuVersionId: null,
      checkedAtIso,
      skippedReason: "no_published_version",
      issues: [],
    };
  }

  const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
  if (!parsed.success) {
    return {
      ok: false,
      vendorId,
      publishedMenuVersionId: published.id,
      checkedAtIso,
      issues: [
        {
          code: "CANONICAL_PARSE_FAILED",
          message: "Published MenuVersion canonicalSnapshot failed schema validation.",
        },
      ],
    };
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { vendorId },
    select: { deliverectProductId: true, deliverectPlu: true, isAvailable: true },
  });

  const modifierGroups = await prisma.modifierGroup.findMany({
    where: { vendorId },
    select: {
      deliverectModifierGroupId: true,
      isAvailable: true,
      options: {
        select: { deliverectModifierId: true, isAvailable: true },
      },
    },
  });

  const issues = analyzeMenuParity(parsed.data, menuItems, modifierGroups);

  return {
    ok: issues.length === 0,
    vendorId,
    publishedMenuVersionId: published.id,
    checkedAtIso,
    issues,
  };
}
