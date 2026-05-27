import { Prisma, VendorFulfillmentStatus, VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DELIVERECT_RECONCILIATION_STALE_MINUTES } from "@/lib/admin-exceptions";

const RECENT_HOURS = 24;

/** Operational Deliverect / reconciliation snapshot for POS sync tooling (same window as legacy overview). */
export async function AdminDeliverectTriageSection() {
  const since = new Date(Date.now() - RECENT_HOURS * 60 * 60 * 1000);
  const reconciliationStaleBefore = new Date(
    Date.now() - DELIVERECT_RECONCILIATION_STALE_MINUTES * 60 * 1000
  );

  const deliverectChannelOr = {
    OR: [{ deliverectChannelLinkId: { not: null } }, { vendor: { deliverectChannelLinkId: { not: null } } }],
  };

  const [
    deliverectAwaitingPos,
    deliverectRecoOverdue,
    deliverectAutoNoMatch24h,
    deliverectAutoAmbiguous24h,
    deliverectManualRecovery24h,
    deliverectRecoLate24h,
  ] = await Promise.all([
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        manuallyRecoveredAt: null,
        deliverectSubmittedAt: { not: null, gte: reconciliationStaleBefore },
        ...deliverectChannelOr,
      },
    }),
    prisma.vendorOrder.count({
      where: {
        routingStatus: VendorRoutingStatus.sent,
        fulfillmentStatus: VendorFulfillmentStatus.pending,
        lastExternalStatusAt: null,
        manuallyRecoveredAt: null,
        deliverectSubmittedAt: { not: null, lt: reconciliationStaleBefore },
        ...deliverectChannelOr,
      },
    }),
    prisma.vendorOrder.count({
      where: {
        deliverectAutoRecheckResult: "no_match",
        updatedAt: { gte: since },
      },
    }),
    prisma.vendorOrder.count({
      where: {
        deliverectAutoRecheckResult: "ambiguous",
        updatedAt: { gte: since },
      },
    }),
    prisma.vendorOrder.count({
      where: { manuallyRecoveredAt: { gte: since, not: null } },
    }),
    prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM "VendorOrder"
        WHERE "lastExternalStatusAt" >= ${since}
          AND "deliverectSubmittedAt" IS NOT NULL
          AND "lastExternalStatusAt" IS NOT NULL
          AND EXTRACT(EPOCH FROM ("lastExternalStatusAt" - "deliverectSubmittedAt")) >= ${DELIVERECT_RECONCILIATION_STALE_MINUTES * 60}
      `
    ),
  ]);

  const recoLateCount = Number(deliverectRecoLate24h[0]?.c ?? BigInt(0));

  return (
    <section className="rounded-lg border border-oo-light-stone bg-oo-warm-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-oo-charcoal">Deliverect triage (last {RECENT_HOURS}h)</h2>
      <p className="mt-1 text-xs text-oo-stone-gray">
        Snapshot counts — same reconciliation window ({DELIVERECT_RECONCILIATION_STALE_MINUTES} min) as ops tooling.
      </p>
      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Awaiting POS (in window)</dt>
          <dd className="text-base font-semibold text-oo-charcoal">{deliverectAwaitingPos}</dd>
        </div>
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Reconciliation overdue</dt>
          <dd className="text-base font-semibold text-amber-900">{deliverectRecoOverdue}</dd>
        </div>
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Auto re-check · no match</dt>
          <dd className="text-base font-semibold text-oo-charcoal">{deliverectAutoNoMatch24h}</dd>
        </div>
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Auto re-check · ambiguous</dt>
          <dd className="text-base font-semibold text-oo-charcoal">{deliverectAutoAmbiguous24h}</dd>
        </div>
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Reconciled late (first signal)</dt>
          <dd className="text-base font-semibold text-oo-charcoal">{recoLateCount}</dd>
        </div>
        <div className="rounded border border-oo-light-stone bg-oo-cream/80 px-3 py-2">
          <dt className="text-oo-stone-gray">Manual recovery recorded</dt>
          <dd className="text-base font-semibold text-oo-charcoal">{deliverectManualRecovery24h}</dd>
        </div>
      </dl>
      <p className="mt-3 text-[10px] text-oo-stone-gray">
        “Reconciled late” = first external status at or after the overdue threshold from submit, updated in the last{" "}
        {RECENT_HOURS}h.
      </p>
    </section>
  );
}
