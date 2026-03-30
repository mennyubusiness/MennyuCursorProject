/**
 * One-off / scheduled cleanup: delete Cart rows that are clearly abandoned.
 *
 * Deletion criteria (all must hold):
 * - Zero CartItem rows (we never delete carts that still hold line items).
 * - Cart.updatedAt older than the retention window — last activity is stale.
 * - No Order in pending_payment or failed still references this cart via sourceCartId
 *   (those flows may still expect the cart row to exist for retry / reconciliation).
 *
 * Why exclude carts with items: line items represent an active or recent basket; deleting
 * the parent Cart would cascade-delete CartItem rows and destroy customer data.
 *
 * Why check pending_payment / failed even for empty carts: checkout may clear line items
 * before payment completes, or failed paths may leave an empty cart while Order.sourceCartId
 * still points here; removing the row could confuse retry or idempotent cleanup code.
 *
 * Order.sourceCartId has no DB FK to Cart — deleting a cart can leave a dangling string on
 * historical orders. That is acceptable for completed orders; we only block deletes when
 * the referencing order is still in a retryable payment state.
 *
 * Usage:
 *   npx tsx scripts/cleanup-old-empty-carts.ts              # dry-run (default)
 *   npx tsx scripts/cleanup-old-empty-carts.ts --execute    # perform deletes
 *
 * Optional env:
 *   CART_CLEANUP_RETENTION_DAYS=14   (default 14)
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Default retention; override with CART_CLEANUP_RETENTION_DAYS */
const RETENTION_DAYS = (() => {
  const raw = process.env.CART_CLEANUP_RETENTION_DAYS;
  if (raw === undefined || raw === "") return 14;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error(`Invalid CART_CLEANUP_RETENTION_DAYS: ${raw}`);
  }
  return n;
})();

const EXECUTE = process.argv.includes("--execute");

function cutoffDate(): Date {
  return new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

async function main(): Promise<void> {
  const cutoff = cutoffDate();

  console.log("[cleanup-old-empty-carts] configuration", {
    retentionDays: RETENTION_DAYS,
    cutoffIso: cutoff.toISOString(),
    mode: EXECUTE ? "EXECUTE (will delete)" : "DRY-RUN (no deletes)",
  });

  const candidates = await prisma.cart.findMany({
    where: {
      updatedAt: { lt: cutoff },
      items: { none: {} },
    },
    select: { id: true, podId: true, sessionId: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  });

  const candidateIds = candidates.map((c) => c.id);

  const blockingOrders =
    candidateIds.length === 0
      ? []
      : await prisma.order.findMany({
          where: {
            sourceCartId: { in: candidateIds },
            status: { in: ["pending_payment", "failed"] },
          },
          select: { id: true, sourceCartId: true, status: true },
        });

  const blockedCartIds = new Set(
    blockingOrders.map((o) => o.sourceCartId).filter((id): id is string => id != null)
  );

  const selectedForDeletion = candidates.filter((c) => !blockedCartIds.has(c.id));

  console.log("[cleanup-old-empty-carts] summary", {
    candidateCartsFound: candidates.length,
    excludedDueToPendingOrFailedOrder: blockingOrders.length,
    selectedForDeletion: selectedForDeletion.length,
  });

  if (blockingOrders.length > 0) {
    console.log("[cleanup-old-empty-carts] excluded (order still references cart)", {
      orders: blockingOrders.map((o) => ({ orderId: o.id, sourceCartId: o.sourceCartId, status: o.status })),
    });
  }

  console.log("[cleanup-old-empty-carts] ids selected for deletion", {
    ids: selectedForDeletion.map((c) => c.id),
  });

  if (selectedForDeletion.length === 0) {
    console.log("[cleanup-old-empty-carts] nothing to delete");
    return;
  }

  if (!EXECUTE) {
    console.log("[cleanup-old-empty-carts] dry-run complete — re-run with --execute to delete");
    return;
  }

  const result = await prisma.cart.deleteMany({
    where: { id: { in: selectedForDeletion.map((c) => c.id) } },
  });

  console.log("[cleanup-old-empty-carts] deleted", { count: result.count });
}

main()
  .catch((e) => {
    console.error("[cleanup-old-empty-carts] fatal", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
