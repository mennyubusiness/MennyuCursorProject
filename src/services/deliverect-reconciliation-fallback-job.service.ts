/**
 * Cron-safe batch: at most one automatic Deliverect GET fallback per overdue episode per VendorOrder.
 * Claims rows with deliverectAutoRecheckAttemptedAt IS NULL before calling attemptDeliverectReconciliationFallback.
 */
import { VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  DELIVERECT_RECONCILIATION_STALE_MINUTES,
} from "@/lib/admin-exceptions";
import {
  attemptDeliverectReconciliationFallback,
  type DeliverectFallbackResult,
} from "@/services/deliverect-reconciliation-fallback.service";

const LOG_PREFIX = "[Deliverect auto-reconciliation job]";

function summarizeFallbackResult(r: DeliverectFallbackResult): string {
  switch (r.outcome) {
    case "applied":
      return "applied";
    case "noop":
      return "noop";
    case "no_match":
      return "no_match";
    case "ambiguous":
      return "ambiguous";
    case "not_eligible":
      return `not_eligible:${r.reason}`;
    default: {
      const _x: never = r;
      return String(_x);
    }
  }
}

export type DeliverectAutoReconciliationJobSummary = {
  scanned: number;
  eligible: number;
  claimed: number;
  attempted: number;
  successApplied: number;
  noop: number;
  noMatch: number;
  ambiguous: number;
  notEligible: number;
  errors: number;
  skippedAlreadyClaimed: number;
};

const DEFAULT_BATCH = 40;

/**
 * Vendor orders overdue for Deliverect reconciliation, Deliverect-routed, not manually recovered,
 * and never subjected to automatic recheck in this unresolved episode (deliverectAutoRecheckAttemptedAt IS NULL).
 */
export async function findVendorOrdersEligibleForAutomaticDeliverectFallback(opts: {
  now?: Date;
  take?: number;
}): Promise<string[]> {
  const now = opts.now ?? new Date();
  const take = opts.take ?? DEFAULT_BATCH;
  const staleMs = DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000;
  const reconciliationStaleBefore = new Date(now.getTime() - staleMs);

  const rows = await prisma.vendorOrder.findMany({
    where: {
      routingStatus: VendorRoutingStatus.sent,
      fulfillmentStatus: VendorFulfillmentStatus.pending,
      lastExternalStatusAt: null,
      manuallyRecoveredAt: null,
      deliverectSubmittedAt: { not: null, lt: reconciliationStaleBefore },
      deliverectAutoRecheckAttemptedAt: null,
      OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
    },
    select: { id: true },
    orderBy: { deliverectSubmittedAt: "asc" },
    take,
  });
  return rows.map((r) => r.id);
}

/**
 * Runs automatic overdue fallback for each eligible id: claim → attempt (onlyIfOverdue + trigger automatic) → persist result code.
 */
export async function runDeliverectAutomaticReconciliationFallback(opts?: {
  now?: Date;
  take?: number;
}): Promise<DeliverectAutoReconciliationJobSummary> {
  const now = opts?.now ?? new Date();
  const take = opts?.take ?? DEFAULT_BATCH;
  const candidateIds = await findVendorOrdersEligibleForAutomaticDeliverectFallback({ now, take });

  const summary: DeliverectAutoReconciliationJobSummary = {
    scanned: candidateIds.length,
    eligible: candidateIds.length,
    claimed: 0,
    attempted: 0,
    successApplied: 0,
    noop: 0,
    noMatch: 0,
    ambiguous: 0,
    notEligible: 0,
    errors: 0,
    skippedAlreadyClaimed: 0,
  };

  console.info(
    `${LOG_PREFIX} started scanned=${summary.scanned} staleMinutes=${DELIVERECT_RECONCILIATION_STALE_MINUTES} take=${take}`
  );

  const staleBefore = new Date(now.getTime() - DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000);

  for (const vendorOrderId of candidateIds) {
    const claim = await prisma.vendorOrder.updateMany({
      where: {
        id: vendorOrderId,
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        manuallyRecoveredAt: null,
        deliverectSubmittedAt: { not: null, lt: staleBefore },
        deliverectAutoRecheckAttemptedAt: null,
        OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
      },
      data: { deliverectAutoRecheckAttemptedAt: now },
    });

    if (claim.count === 0) {
      summary.skippedAlreadyClaimed += 1;
      console.info(
        `${LOG_PREFIX} skipped_already_claimed_or_state_changed vendorOrderId=${vendorOrderId}`
      );
      continue;
    }

    summary.claimed += 1;
    console.info(`${LOG_PREFIX} claimed vendorOrderId=${vendorOrderId}`);

    try {
      const result = await attemptDeliverectReconciliationFallback(vendorOrderId, {
        onlyIfOverdue: true,
        allowAfterManualRecovery: false,
        trigger: "automatic",
      });
      summary.attempted += 1;

      const code = summarizeFallbackResult(result);
      await prisma.vendorOrder.update({
        where: { id: vendorOrderId },
        data: { deliverectAutoRecheckResult: code },
      });

      switch (result.outcome) {
        case "applied":
          summary.successApplied += 1;
          break;
        case "noop":
          summary.noop += 1;
          break;
        case "no_match":
          summary.noMatch += 1;
          break;
        case "ambiguous":
          summary.ambiguous += 1;
          break;
        case "not_eligible":
          summary.notEligible += 1;
          break;
        default:
          break;
      }

      console.info(
        `${LOG_PREFIX} fallback_finished vendorOrderId=${vendorOrderId} outcome=${result.outcome} summaryCode=${code}`
      );
    } catch (err) {
      summary.errors += 1;
      summary.attempted += 1;
      const message = err instanceof Error ? err.message : String(err);
      await prisma.vendorOrder.update({
        where: { id: vendorOrderId },
        data: { deliverectAutoRecheckResult: `error:${message.slice(0, 200)}` },
      });
      console.error(
        `${LOG_PREFIX} fallback_error vendorOrderId=${vendorOrderId} error=${message.slice(0, 500)}`
      );
    }
  }

  console.info(
    `${LOG_PREFIX} summary scanned=${summary.scanned} eligible=${summary.eligible} claimed=${summary.claimed} attempted=${summary.attempted} applied=${summary.successApplied} noop=${summary.noop} no_match=${summary.noMatch} ambiguous=${summary.ambiguous} not_eligible=${summary.notEligible} errors=${summary.errors} skippedRace=${summary.skippedAlreadyClaimed}`
  );

  return summary;
}
