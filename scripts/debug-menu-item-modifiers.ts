/**
 * Inspect modifier / variant groups for a menu item by name (local dev).
 *
 * Usage:
 *   npx tsx scripts/debug-menu-item-modifiers.ts "White Rice"
 *   npx tsx scripts/debug-menu-item-modifiers.ts "White Rice" --vendorId=<cuid>
 */
import { PrismaClient } from "@prisma/client";
import { classifyMenuItemModifierLink } from "../src/lib/modifier-group-rules";
import { isTopLevelDeliverectVariantGroupModifierGroup } from "../src/lib/deliverect-subitem-nesting";
import { formatModifierGroupNoteFromClassification } from "../src/lib/modifier-group-rules";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const nameQuery = args.find((a) => !a.startsWith("--")) ?? "White Rice";
  const vendorIdArg = args.find((a) => a.startsWith("--vendorId="))?.split("=")[1];

  const items = await prisma.menuItem.findMany({
    where: {
      name: { contains: nameQuery, mode: "insensitive" },
      ...(vendorIdArg ? { vendorId: vendorIdArg } : {}),
    },
    include: {
      vendor: { select: { id: true, name: true } },
      modifierGroups: {
        orderBy: { sortOrder: "asc" },
        include: {
          modifierGroup: {
            include: {
              options: { orderBy: { sortOrder: "asc" } },
            },
          },
        },
      },
    },
    take: 5,
  });

  if (items.length === 0) {
    console.log(`No menu items matching "${nameQuery}"`);
    return;
  }

  for (const item of items) {
    console.log("\n" + "=".repeat(72));
    console.log("MenuItem:", item.name);
    console.log("id:", item.id);
    console.log("vendor:", item.vendor.name, item.vendorId);
    console.log("deliverectPlu:", item.deliverectPlu);
    console.log("deliverectVariantParentPlu:", item.deliverectVariantParentPlu);
    console.log("priceCents:", item.priceCents);
    console.log("isAvailable:", item.isAvailable);

    const variantChildren = item.deliverectPlu
      ? await prisma.menuItem.count({
          where: {
            vendorId: item.vendorId,
            deliverectVariantParentPlu: item.deliverectPlu,
          },
        })
      : 0;
    console.log("variantChildMenuItemCount:", variantChildren);

    for (const link of item.modifierGroups) {
      const g = link.modifierGroup;
      const topVariant = isTopLevelDeliverectVariantGroupModifierGroup(g);
      console.log("\n  Group:", g.name);
      console.log("    groupId:", g.id);
      console.log("    deliverectIsVariantGroup:", g.deliverectIsVariantGroup);
      console.log("    topLevelVariant:", topVariant);
      const classification = classifyMenuItemModifierLink(link, variantChildren);
      console.log("    openOrderGroupKind:", classification.kind);
      console.log("    blocksAddToCartWhenEmpty:", classification.blocksAddToCartWhenEmpty);
      console.log("    requiresVariantLeaf:", classification.requiresDeliverectVariantLeafResolution);
      console.log("    group.isAvailable:", g.isAvailable);
      console.log("    link.required:", link.required);
      console.log("    link.min/max:", link.minSelections, link.maxSelections);
      console.log(
        "    UI note:",
        formatModifierGroupNoteFromClassification(classification)
      );
      console.log("    options:", g.options.length);
      for (const o of g.options) {
        console.log(
          `      - ${o.name} | available=${o.isAvailable} | plu=${o.deliverectModifierPlu ?? "—"} | +$${(o.priceCents / 100).toFixed(2)}`
        );
      }
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
