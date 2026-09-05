/**
 * Repair vendors whose orderRoutingMode and published menu source disagree,
 * or whose native Open Order availability was poisoned by catalog retirement.
 *
 * Usage:
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts --execute
 *   npx tsx scripts/repair-vendor-menu-source-ownership.ts --vendor=<id> --execute
 */
import "dotenv/config";
import { repairInconsistentVendorMenuSourceOwnership } from "../src/services/vendor-menu-source-ownership";

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
        reports: result.reports.map((r) => ({
          vendorId: r.vendorId,
          vendorName: r.vendorName,
          repairType: r.repairType,
          reason: r.reason,
          orderRoutingMode: r.orderRoutingMode,
          menuSource: r.menuSource,
          currentAuthority: r.currentAuthority,
          adoptionSource: r.adoptionSource,
          adoptionSourceLabel: r.adoptionSourceLabel,
          selectedCatalog: r.selectedCatalog,
          matchingLiveMenuItemCount: r.matchingLiveMenuItemCount,
          menuItemsThatWouldBeRestored: r.menuItemsThatWouldBeRestored,
          archivedMenuVersionIds: r.archivedMenuVersionIds,
          restoredMenuVersionIds: r.restoredMenuVersionIds,
          multiplePlausibleProviderCatalogs: r.multiplePlausibleProviderCatalogs,
          plausibleProviderOrigins: r.plausibleProviderOrigins,
          selectionReason: r.selectionReason,
          currentPublishedVersionId: r.currentPublishedVersionId,
          historicalSnapshotId: r.historicalSnapshotId,
          historicalPublishedAt: r.historicalPublishedAt,
          nativeItemCount: r.nativeItemCount,
          currentAvailable: r.currentAvailable,
          historicalAvailable: r.historicalAvailable,
          productsToRestore: r.productsToRestore,
          restoredAvailableMenuItemCount: r.restoredAvailableMenuItemCount,
          liveAvailableCount: r.liveAvailableCount,
          liveRowsToCreate: r.liveRowsToCreate,
          liveRowsToUpdateAvailability: r.liveRowsToUpdateAvailability,
          expectedAvailableItemCount: r.expectedAvailableItemCount,
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
