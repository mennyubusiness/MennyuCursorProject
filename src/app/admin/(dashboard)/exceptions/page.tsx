import Link from "next/link";
import { VendorRoutingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  getExceptionType,
  getExceptionReason,
  type ExceptionType,
  ROUTING_STUCK_THRESHOLD_MINUTES,
} from "@/lib/admin-exceptions";
import { getExceptionUrgency } from "@/lib/admin-urgency";
import { isRoutingRetryAvailable } from "@/lib/routing-availability";
import { ExceptionRowActions } from "./ExceptionRowActions";

const ROUTING_STUCK_MS = ROUTING_STUCK_THRESHOLD_MINUTES * 60 * 1000;

export default async function AdminExceptionsPage() {
  const now = new Date();
  const stuckBefore = new Date(now.getTime() - ROUTING_STUCK_MS);

  const [failed, stuckPending] = await Promise.all([
    prisma.vendorOrder.findMany({
      where: { routingStatus: VendorRoutingStatus.failed },
      include: {
        order: { select: { id: true, customerPhone: true, pod: { select: { name: true } } } },
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.vendorOrder.findMany({
      where: {
        routingStatus: VendorRoutingStatus.pending,
        createdAt: { lt: stuckBefore },
      },
      include: {
        order: { select: { id: true, customerPhone: true, pod: { select: { name: true } } } },
        vendor: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const byId = new Map(
    [...failed, ...stuckPending].map((vo) => [
      vo.id,
      {
        ...vo,
        exceptionType: getExceptionType(vo) ?? ("unknown_attention_needed" as ExceptionType),
      },
    ])
  );
  const merged = Array.from(byId.values())
    .filter((vo) => vo.fulfillmentStatus === "pending")
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const routingAvailable = isRoutingRetryAvailable();

  function formatDate(d: Date) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-stone-900">Needs attention</h1>
      <p className="mt-1 text-sm text-stone-600">
        Which vendor orders are broken, and how to resolve them. Use the actions below or view full order details.
      </p>

      {merged.length === 0 ? (
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-stone-700">Nothing needs attention right now</p>
          <p className="mt-1 text-sm text-stone-500">
            All vendor orders are either progressing normally or already resolved.
          </p>
          <Link href="/admin/orders" className="mt-3 inline-block text-sm text-stone-600 hover:underline">
            Inspect orders →
          </Link>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {merged.map((vo) => {
            const type = vo.exceptionType;
            const reason = getExceptionReason(vo, type);
            const urgency = getExceptionUrgency(vo.createdAt);
            const canCancel =
              vo.fulfillmentStatus !== "cancelled" && vo.fulfillmentStatus !== "completed";
            return (
              <li
                key={vo.id}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
                  <div className="space-y-3">
                    <section>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                        Current state
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="font-medium text-stone-900">{vo.vendor.name}</span>
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          {type.replace("_", " ")}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                            urgency.urgency === "critical"
                              ? "bg-red-100 text-red-800"
                              : urgency.urgency === "stuck"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-stone-700"
                          }`}
                          title={urgency.ageText}
                        >
                          {urgency.label}
                        </span>
                        <span className="text-sm text-stone-600">
                          Routing: {vo.routingStatus} · Fulfillment: {vo.fulfillmentStatus}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {urgency.ageText}
                        {" · "}
                        Order <Link href={`/admin/orders/${vo.orderId}`} className="hover:underline">#{vo.orderId.slice(-8).toUpperCase()}</Link>
                        {vo.order.pod?.name && ` · ${vo.order.pod.name}`}
                        {" · "}
                        Customer: {vo.order.customerPhone ?? "—"}
                      </p>
                    </section>
                    <section>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                        Why it needs attention
                      </p>
                      <p className="mt-1 text-sm text-amber-800">{reason}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Age: {urgency.ageMinutes} min
                        {(vo.deliverectAttempts != null && vo.deliverectAttempts > 0) && ` · Attempts: ${vo.deliverectAttempts}`}
                        {vo.deliverectSubmittedAt && ` · Last attempt: ${formatDate(vo.deliverectSubmittedAt)}`}
                      </p>
                      {vo.deliverectLastError && (
                        <p className="mt-0.5 truncate text-xs text-stone-500" title={vo.deliverectLastError}>
                          Last error: {vo.deliverectLastError.length > 80 ? vo.deliverectLastError.slice(0, 80) + "…" : vo.deliverectLastError}
                        </p>
                      )}
                    </section>
                  </div>
                  <div className="space-y-3">
                    <section>
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                        Needs attention actions
                      </p>
                      <div className="mt-1">
                        <ExceptionRowActions
                          vendorOrderId={vo.id}
                          orderId={vo.orderId}
                          exceptionType={type}
                          routingAvailable={routingAvailable}
                          canCancel={canCancel}
                        />
                      </div>
                    </section>
                    <p className="text-xs text-stone-500">
                      <Link href={`/admin/orders/${vo.orderId}`} className="font-medium text-stone-600 hover:underline">
                        View full order details →
                      </Link>
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
