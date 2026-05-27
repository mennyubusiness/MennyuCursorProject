/**
 * Scan published canonical menus and live MenuItem modifier links for Deliverect rule drift.
 *
 * Usage:
 *   npx tsx scripts/audit-deliverect-menu-rules.ts
 *   npx tsx scripts/audit-deliverect-menu-rules.ts --vendorId=<cuid>
 */
import { PrismaClient } from "@prisma/client";
import {
  mennyuCanonicalMenuSchema,
  type MennyuCanonicalMenu,
} from "../src/domain/menu-import/canonical.schema";
import { classifyProductModifierGroupKind } from "../src/domain/canonical-menu-group-kinds";
import { buildVariantChildCountByParentPlu } from "../src/domain/canonical-menu-group-kinds";
import { classifyMenuItemModifierLink } from "../src/lib/modifier-group-rules";

const prisma = new PrismaClient();

type AuditRow = {
  vendorId: string;
  vendorName: string;
  menuItemId: string;
  menuItemName: string;
  deliverectPlu: string | null;
  groupName: string;
  groupDeliverectId: string | null;
  raw: {
    deliverectIsVariantGroup: boolean | null;
    linkRequired: boolean;
    linkMin: number;
    linkMax: number;
    variantChildMenuItemCount: number;
  };
  canonicalKind: string | null;
  liveKind: string;
  uiWouldHide: boolean;
  cartWouldBlock: boolean;
  recommendedAction: string;
};

function recommendedAction(row: AuditRow): string {
  if (row.raw.deliverectIsVariantGroup && row.raw.variantChildMenuItemCount === 0 && row.cartWouldBlock) {
    return "Reclassify as OPTIONAL_VARIANT_OR_MODIFIER_GROUP; republish if link bounds wrong.";
  }
  if (row.raw.deliverectIsVariantGroup && row.raw.variantChildMenuItemCount === 0 && row.liveKind === "OPTIONAL_VARIANT_OR_MODIFIER_GROUP") {
    return "OK — optional variant-flagged group without variant children (e.g. sauce on rice).";
  }
  if (row.uiWouldHide && row.cartWouldBlock) {
    return "Show unavailable required group in UI or snooze parent item.";
  }
  if (row.canonicalKind && row.canonicalKind !== row.liveKind) {
    return "Canonical vs live classification mismatch — republish menu.";
  }
  if (row.raw.deliverectIsVariantGroup && !row.raw.variantChildMenuItemCount && row.liveKind !== "OPTIONAL_VARIANT_OR_MODIFIER_GROUP") {
    return "Variant flag without children should be OPTIONAL_VARIANT_OR_MODIFIER_GROUP.";
  }
  return "OK";
}

async function auditCanonicalMenu(
  vendorId: string,
  vendorName: string,
  menu: MennyuCanonicalMenu,
  rows: AuditRow[]
) {
  const variantCounts = buildVariantChildCountByParentPlu(menu.products);
  const productByDeliverectId = new Map(menu.products.map((p) => [p.deliverectId, p]));

  const rowsDb = await prisma.menuItem.findMany({
    where: { vendorId, deliverectProductId: { in: menu.products.map((p) => p.deliverectId) } },
    include: {
      modifierGroups: {
        include: {
          modifierGroup: {
            select: {
              id: true,
              name: true,
              deliverectModifierGroupId: true,
              deliverectIsVariantGroup: true,
              isAvailable: true,
              parentModifierOptionId: true,
            },
          },
        },
      },
    },
  });

  for (const item of rowsDb) {
    const product = item.deliverectProductId
      ? productByDeliverectId.get(item.deliverectProductId)
      : undefined;
    const plu = item.deliverectPlu?.trim() ?? product?.plu ?? null;
    const variantChildMenuItemCount = plu ? variantCounts.get(plu) ?? 0 : 0;

    for (const link of item.modifierGroups) {
      if (link.modifierGroup.parentModifierOptionId != null) continue;
      const live = classifyMenuItemModifierLink(link, variantChildMenuItemCount);
      const canonicalKind = product
        ? classifyProductModifierGroupKind(
            menu,
            product,
            link.modifierGroup.deliverectModifierGroupId ?? "",
            variantCounts
          )
        : null;

      const uiWouldHide = !link.modifierGroup.isAvailable;
      const cartWouldBlock = live.blocksAddToCartWhenEmpty;

      const row: AuditRow = {
        vendorId,
        vendorName,
        menuItemId: item.id,
        menuItemName: item.name,
        deliverectPlu: plu,
        groupName: link.modifierGroup.name,
        groupDeliverectId: link.modifierGroup.deliverectModifierGroupId,
        raw: {
          deliverectIsVariantGroup: link.modifierGroup.deliverectIsVariantGroup,
          linkRequired: link.required,
          linkMin: link.minSelections,
          linkMax: link.maxSelections,
          variantChildMenuItemCount,
        },
        canonicalKind,
        liveKind: live.kind,
        uiWouldHide,
        cartWouldBlock,
        recommendedAction: "",
      };
      row.recommendedAction = recommendedAction(row);
      if (row.recommendedAction !== "OK" && !row.recommendedAction.startsWith("OK —")) {
        rows.push(row);
      }
    }
  }
}

async function main() {
  const vendorIdArg = process.argv.find((a) => a.startsWith("--vendorId="))?.split("=")[1];
  const vendors = await prisma.vendor.findMany({
    where: vendorIdArg ? { id: vendorIdArg } : {},
    select: { id: true, name: true },
  });

  const flagged: AuditRow[] = [];

  for (const vendor of vendors) {
    const published = await prisma.menuVersion.findFirst({
      where: { vendorId: vendor.id, state: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      select: { canonicalSnapshot: true },
    });
    if (!published?.canonicalSnapshot) continue;
    const parsed = mennyuCanonicalMenuSchema.safeParse(published.canonicalSnapshot);
    if (!parsed.success) continue;
    await auditCanonicalMenu(vendor.id, vendor.name, parsed.data, flagged);
  }

  console.log(`Deliverect menu rules audit — ${flagged.length} issue(s)\n`);
  for (const row of flagged) {
    console.log("—".repeat(72));
    console.log(`${row.vendorName} (${row.vendorId})`);
    console.log(`  Item: ${row.menuItemName} [${row.menuItemId}] PLU=${row.deliverectPlu ?? "—"}`);
    console.log(`  Group: ${row.groupName} deliverectGroupId=${row.groupDeliverectId ?? "—"}`);
    console.log("  Raw:", row.raw);
    console.log(`  Canonical kind: ${row.canonicalKind ?? "—"}`);
    console.log(`  Live kind: ${row.liveKind}`);
    console.log(`  UI hidden: ${row.uiWouldHide} | Cart blocks when empty: ${row.cartWouldBlock}`);
    console.log(`  → ${row.recommendedAction}`);
  }

  if (flagged.length === 0) {
    console.log("No classification drift detected for scanned published menus.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
