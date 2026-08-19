/**
 * Repair vendors whose orderRoutingMode and active/published menu source disagree.
 *
 * Usage:
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts --execute
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts --vendor=<id> --execute
 */
import "dotenv/config";
import { repairInconsistentVendorMenuSourceOwnership } from "../src/services/vendor-menu-source-ownership.service";

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const vendorArg = args.find((a) => a.startsWith("--vendor="));
  const vendorId = vendorArg?.slice("--vendor=".length)?.trim() || undefined;

  const result = await repairInconsistentVendorMenuSourceOwnership({
    vendorId,
    dryRun: !execute,
  });

  console.log(
    JSON.stringify(
      {
        dryRun: result.dryRun,
        scanned: result.scanned,
        repairedCount: result.repaired.length,
        repaired: result.repaired.map((r) => ({
          vendorId: r.vendorId,
          orderRoutingMode: r.orderRoutingMode,
          previousMenuSource: r.previousMenuSource,
          menuSource: r.menuSource,
          provider: r.provider,
          archivedMenuVersionIds: r.archivedMenuVersionIds,
          restoredMenuVersionIds: r.restoredMenuVersionIds,
          softDisabledMenuItemCount: r.softDisabledMenuItemCount,
          restoredAvailableMenuItemCount: r.restoredAvailableMenuItemCount,
        })),
      },
      null,
      2
    )
  );

  if (!execute) {
    console.log("\nDry run only. Pass --execute to apply repairs.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
