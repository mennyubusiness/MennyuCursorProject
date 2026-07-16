/**
 * One-time reconciliation: resolve stale OPEN VendorOrderIssue rows of type
 * `manual_recovery` that are artifacts of successful manual recovery (not
 * actionable problems).
 *
 * Conservative eligibility (all must hold):
 * - Issue type is manual_recovery and status is OPEN
 * - Vendor order has manuallyRecoveredAt set
 * - Vendor fulfillment is accepted, preparing, ready, or completed
 * - Any sibling routing_failure issues are already RESOLVED (or none exist)
 *
 * Does not touch customer OrderIssue rows or other vendor issue types.
 *
 * Usage:
 *   npx tsx scripts/cleanup-stale-manual-recovery-issues.ts           # dry-run
 *   npx tsx scripts/cleanup-stale-manual-recovery-issues.ts --execute # mutate
 */
import "dotenv/config";
import { PrismaClient, VendorFulfillmentStatus } from "@prisma/client";

const prisma = new PrismaClient();
const execute = process.argv.includes("--execute");

const PROGRESSED_FULFILLMENT: VendorFulfillmentStatus[] = [
  VendorFulfillmentStatus.accepted,
  VendorFulfillmentStatus.preparing,
  VendorFulfillmentStatus.ready,
  VendorFulfillmentStatus.completed,
];

async function main() {
  const candidates = await prisma.vendorOrderIssue.findMany({
    where: {
      type: "manual_recovery",
      status: "OPEN",
      vendorOrder: {
        manuallyRecoveredAt: { not: null },
        fulfillmentStatus: { in: PROGRESSED_FULFILLMENT },
      },
    },
    include: {
      vendorOrder: {
        select: {
          id: true,
          orderId: true,
          fulfillmentStatus: true,
          routingStatus: true,
          manuallyRecoveredAt: true,
          issues: {
            where: { type: "routing_failure" },
            select: { id: true, status: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const eligible = candidates.filter((row) => {
    const routingFailures = row.vendorOrder.issues;
    if (routingFailures.length === 0) return true;
    return routingFailures.every((i) => i.status === "RESOLVED");
  });

  const orderIds = [...new Set(eligible.map((r) => r.vendorOrder.orderId))];

  console.log(
    `[cleanup-stale-manual-recovery] mode=${execute ? "EXECUTE" : "DRY-RUN"}`
  );
  console.log(`candidates scanned: ${candidates.length}`);
  console.log(`eligible to resolve: ${eligible.length}`);
  console.log(`affected order IDs (${orderIds.length}):`);
  for (const id of orderIds) {
    console.log(`  - ${id}`);
  }
  for (const row of eligible) {
    console.log(
      `  issue=${row.id} vo=${row.vendorOrderId} order=${row.vendorOrder.orderId} fulfillment=${row.vendorOrder.fulfillmentStatus}`
    );
  }

  if (!execute) {
    console.log("Dry-run only. Re-run with --execute to resolve issues.");
    return;
  }

  let resolved = 0;
  for (const row of eligible) {
    await prisma.$transaction(async (tx) => {
      await tx.vendorOrderIssue.update({
        where: { id: row.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedBy: "cleanup-stale-manual-recovery",
          notes: [
            row.notes?.trim(),
            "[repair] Resolved stale open manual_recovery artifact after confirmed manual recovery.",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      });
      await tx.vendorOrderStatusHistory.create({
        data: {
          vendorOrderId: row.vendorOrderId,
          routingStatus: row.vendorOrder.routingStatus,
          fulfillmentStatus: row.vendorOrder.fulfillmentStatus,
          source: "admin_repair_stale_manual_recovery",
          statusSource: "admin_action",
          rawPayload: {
            audit: {
              kind: "cleanup_stale_manual_recovery_issue",
              issueId: row.id,
              summary: "Resolved stale open manual_recovery issue after successful recovery",
            },
          },
        },
      });
    });
    resolved += 1;
  }

  console.log(`Resolved ${resolved} stale manual_recovery issue(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
