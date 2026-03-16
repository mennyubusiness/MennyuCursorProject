import Link from "next/link";
import { Prisma, VendorRoutingStatus, VendorFulfillmentStatus } from "@prisma/client";
import { getOrderIdsNeedingAttention } from "@/lib/admin-attention";
import { prisma } from "@/lib/db";
import { parentStatusLabel } from "@/domain/order-state";
import { getOrderIdsWithOpenIssues } from "@/services/issues.service";

type OrderFindManyArgs = NonNullable<Parameters<typeof prisma.order.findMany>[0]>;
type OrderWhere = NonNullable<OrderFindManyArgs["where"]>;

type SearchParams = Promise<{
  pod?: string;
  status?: string;
  vendor?: string;
  attention?: string;
  q?: string;
}>;

function buildQueryString(overrides: Record<string, string | undefined>) {
  const entries = Object.entries(overrides).filter(([, v]) => v != null && v !== "") as [string, string][];
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : "";
}

function matchReason(
  order: { id: string; customerPhone: string | null; pod: { name: string }; vendorOrders: { vendor: { name: string } }[] },
  term: string
): string | null {
  const t = term.toLowerCase();
  if (order.id.toLowerCase().includes(t)) return "Order ID";
  if (order.customerPhone?.toLowerCase().includes(t)) return "Phone";
  if (order.pod.name.toLowerCase().includes(t)) return "Pod";
  if (order.vendorOrders.some((vo) => vo.vendor.name.toLowerCase().includes(t))) return "Vendor";
  return null;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const podId = params.pod?.trim() || undefined;
  const statusFilter = params.status?.trim() || undefined;
  const vendorId = params.vendor?.trim() || undefined;
  const attentionOnly = params.attention === "1";
  const searchTerm = params.q?.trim() || undefined;

  const hasFilters = Boolean(podId || statusFilter || vendorId || attentionOnly);
  const hasSearch = Boolean(searchTerm);
  const clearSearchHref = hasSearch
    ? `/admin/orders${buildQueryString({ pod: podId, status: statusFilter, vendor: vendorId, attention: attentionOnly ? "1" : undefined })}`
    : null;
  const resetAllHref = hasSearch || hasFilters ? "/admin/orders" : null;

  const where: OrderWhere = {};
  if (podId) where.podId = podId;
  if (statusFilter) where.status = statusFilter as OrderWhere["status"];

  let orderIds: string[] | undefined;
  if (vendorId || attentionOnly) {
    if (attentionOnly && !vendorId) {
      orderIds = await getOrderIdsNeedingAttention();
    } else {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const voWhere: Prisma.VendorOrderWhereInput = {};
      if (vendorId) voWhere.vendorId = vendorId;
      if (attentionOnly) {
        voWhere.OR = [
          { routingStatus: VendorRoutingStatus.failed },
          {
            fulfillmentStatus: VendorFulfillmentStatus.pending,
            routingStatus: {
              in: [VendorRoutingStatus.sent, VendorRoutingStatus.confirmed],
            },
            createdAt: { lt: twoHoursAgo },
          },
        ];
      }
      const [vos, openIssueOrderIds] = await Promise.all([
        prisma.vendorOrder.findMany({
          where: Object.keys(voWhere).length ? voWhere : undefined,
          select: { orderId: true },
          take: attentionOnly ? 500 : undefined,
        }),
        attentionOnly ? getOrderIdsWithOpenIssues() : Promise.resolve([]),
      ]);
      const fromVo = [...new Set(vos.map((v) => v.orderId))];
      orderIds = attentionOnly
        ? [...new Set([...fromVo, ...openIssueOrderIds])]
        : fromVo.length > 0 ? fromVo : undefined;
    }
    if (orderIds?.length === 0 && (vendorId || attentionOnly)) {
      orderIds = [];
    }
  }
  if (orderIds && orderIds.length === 0) where.id = { in: [] };
  else if (orderIds) where.id = { in: orderIds };

  if (searchTerm) {
    const searchConditions: OrderWhere[] = [
      { id: { contains: searchTerm, mode: "insensitive" } },
      { customerPhone: { contains: searchTerm, mode: "insensitive" } },
      { pod: { name: { contains: searchTerm, mode: "insensitive" } } },
      { vendorOrders: { some: { vendor: { name: { contains: searchTerm, mode: "insensitive" } } } } },
    ];
    const existingAnd = Object.keys(where).length ? { ...where } : undefined;
    (where as Record<string, unknown>).AND = existingAnd
      ? [existingAnd, { OR: searchConditions }]
      : [{ OR: searchConditions }];
    delete (where as Record<string, unknown>).podId;
    delete (where as Record<string, unknown>).status;
    delete (where as Record<string, unknown>).id;
  }

  const [orders, pods, vendors] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        customerPhone: true,
        status: true,
        totalCents: true,
        pod: { select: { id: true, name: true } },
        vendorOrders: {
          select: {
            id: true,
            routingStatus: true,
            fulfillmentStatus: true,
            vendor: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.pod.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.vendor.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  function formatDate(d: Date) {
    return new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short" }).format(d);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Orders</h1>
        <p className="mt-1 text-sm text-stone-600">
          Inspect orders and manage their lifecycle. Search by order ID, phone, vendor, or pod.
        </p>
      </div>

      {/* Primary: search */}
      <form method="get" className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={searchTerm ?? ""}
            placeholder="Order ID, phone, vendor, or pod"
            className="min-w-[280px] rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder-stone-400 focus:border-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-400"
            aria-label="Search orders"
          />
          <button
            type="submit"
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
          >
            Search
          </button>
        </div>

        {/* Secondary: filters */}
        <div className="rounded-lg border border-stone-200 bg-stone-50/80 px-3 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">Filters</p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              name="pod"
              defaultValue={podId ?? ""}
              className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700"
              aria-label="Filter by pod"
            >
              <option value="">All pods</option>
              {pods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={statusFilter ?? ""}
              className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="pending_payment">pending_payment</option>
              <option value="paid">paid</option>
              <option value="routing">routing</option>
              <option value="routed">routed</option>
              <option value="routed_partial">routed_partial</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
              <option value="cancelled">cancelled</option>
            </select>
            <select
              name="vendor"
              defaultValue={vendorId ?? ""}
              className="rounded border border-stone-300 bg-white px-2 py-1.5 text-sm text-stone-700"
              aria-label="Filter by vendor"
            >
              <option value="">All vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                name="attention"
                value="1"
                defaultChecked={attentionOnly}
                className="rounded border-stone-300"
              />
              Needs attention only
            </label>
            <button
              type="submit"
              className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
            >
              Apply filters
            </button>
          </div>
        </div>
      </form>

      {/* Search state feedback + reset */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-stone-600">
        {hasSearch && (
          <span>
            Showing results for &quot;<span className="font-medium text-stone-800">{searchTerm}</span>&quot;
          </span>
        )}
        <span>
          {orders.length === 0
            ? "No matching orders"
            : `${orders.length} matching order${orders.length === 1 ? "" : "s"}`}
        </span>
        {(clearSearchHref || resetAllHref) && (
          <span className="flex items-center gap-2">
            {clearSearchHref && (
              <Link href={clearSearchHref} className="text-stone-600 underline hover:text-stone-900">
                Clear search
              </Link>
            )}
            {resetAllHref && (
              <>
                {clearSearchHref && <span className="text-stone-400">·</span>}
                <Link href={resetAllHref} className="text-stone-600 underline hover:text-stone-900">
                  Reset all
                </Link>
              </>
            )}
          </span>
        )}
      </div>

      <ul className="space-y-3">
        {orders.length === 0 ? (
          <li className="rounded-xl border border-stone-200 bg-stone-50/50 px-6 py-10 text-center">
            <p className="font-medium text-stone-700">No matching orders found</p>
            <p className="mt-1 text-sm text-stone-500">
              Try a different order ID, phone number, vendor, or pod.
              {hasFilters && " You can also clear filters above."}
            </p>
            <Link
              href="/admin/orders"
              className="mt-4 inline-block text-sm text-stone-600 underline hover:text-stone-900"
            >
              View all orders
            </Link>
          </li>
        ) : (
          orders.map((order) => {
            const reason = searchTerm ? matchReason(order, searchTerm) : null;
            return (
              <li
                key={order.id}
                className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-mono text-sm font-medium text-stone-900 hover:underline"
                      >
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                      {reason && (
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-500">
                          matched {reason}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">{formatDate(order.createdAt)}</p>
                    <p className="text-sm text-stone-600">{order.customerPhone}</p>
                    <p className="text-sm text-stone-700">{order.pod.name}</p>
                    <p className="text-xs text-stone-500">
                      {order.vendorOrders.map((vo) => vo.vendor.name).join(", ")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-stone-900">
                      {parentStatusLabel(order.status as Parameters<typeof parentStatusLabel>[0])}
                    </p>
                    <p className="mt-1 text-xs text-stone-600">
                      {order.vendorOrders.map(
                        (vo) => `${vo.vendor.name}: ${vo.routingStatus}/${vo.fulfillmentStatus}`
                      ).join(" · ")}
                    </p>
                    <p className="mt-1 font-medium text-stone-900">
                      ${(order.totalCents / 100).toFixed(2)}
                    </p>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="mt-2 inline-block text-sm text-stone-600 hover:text-stone-900"
                    >
                      View details →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
