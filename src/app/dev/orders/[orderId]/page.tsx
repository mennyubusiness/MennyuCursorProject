import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderStatusAction } from "@/actions/order.actions";
import { getOrderVendorOrdersForDeliverect } from "@/integrations/deliverect/load";
import { mennyuVendorOrderToDeliverectPayload } from "@/integrations/deliverect/transform";
import { SimulatorControls } from "./SimulatorControls";

/**
 * Development-only: order lifecycle simulator page.
 * Use to advance VendorOrder states without Deliverect. Not for production.
 */
export default async function DevOrderSimulatorPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { orderId } = await params;
  const order = await getOrderStatusAction(orderId);
  if (!order) notFound();

  const hydratedVendorOrders = await getOrderVendorOrdersForDeliverect(orderId);
  const payloads = hydratedVendorOrders.map((vo) => {
    const channelLinkId =
      vo.vendor.deliverectChannelLinkId ?? vo.deliverectChannelLinkId ?? "__placeholder_channel__";
    const payload = mennyuVendorOrderToDeliverectPayload({
      vendorOrder: vo,
      channelLinkId,
      locationId: vo.vendor.deliverectLocationId ?? undefined,
      customerPhone: vo.order.customerPhone,
      customerEmail: vo.order.customerEmail ?? null,
      preparationTimeMinutes: 15,
    });
    return { vendorOrderId: vo.id, vendorName: vo.vendor.name, payload };
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded border-2 border-amber-200 bg-amber-50/50 p-3 text-sm text-amber-900">
        <strong>Dev only:</strong> Order lifecycle simulator. Advance vendor order states for testing. No Deliverect/Stripe/Twilio.
      </div>

      <div>
        <Link href="/explore" className="text-mennyu-primary hover:underline">
          ← Explore
        </Link>
        <span className="mx-2">·</span>
        <Link href={`/order/${orderId}`} className="text-mennyu-primary hover:underline">
          Customer order view
        </Link>
      </div>

      <h1 className="text-xl font-semibold">Order #{order.id.slice(-8).toUpperCase()}</h1>
      <p className="text-stone-600">
        Parent status: <strong>{order.statusLabel ?? order.derivedStatus ?? order.status}</strong>
      </p>

      <div className="space-y-4">
        <h2 className="font-medium">Vendor orders</h2>
        {order.vendorOrders.map((vo) => (
          <div
            key={vo.id}
            className="rounded-lg border border-stone-200 bg-white p-4"
          >
            <p className="font-medium">{vo.vendor.name}</p>
            <p className="text-sm text-stone-600">
              Routing: {vo.routingStatus} · Fulfillment: {vo.fulfillmentStatus}
            </p>
            <SimulatorControls
              vendorOrderId={vo.id}
              currentRouting={vo.routingStatus}
              currentFulfillment={vo.fulfillmentStatus}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-600 dark:bg-stone-800/50">
        <h2 className="font-medium text-stone-900 dark:text-stone-100">Deliverect payload preview</h2>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          Generated payload per vendor order (no API submission). Readable in light and dark themes.
        </p>
        <a
          href={`/api/dev/orders/${orderId}/deliverect-payload`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-mennyu-primary hover:underline"
        >
          Open raw JSON in new tab →
        </a>

        {payloads.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">No vendor orders to show payloads for.</p>
        ) : (
          <div className="mt-4 space-y-6">
            {payloads.map(({ vendorOrderId, vendorName, payload }) => (
              <div key={vendorOrderId} className="rounded border border-stone-200 bg-white dark:border-stone-600 dark:bg-stone-800/80">
                <p className="border-b border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 dark:border-stone-600 dark:text-stone-300">
                  {vendorName}
                </p>
                <pre className="overflow-x-auto p-3 text-xs leading-relaxed text-stone-800 dark:text-stone-200" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                  <code>{JSON.stringify(payload, null, 2)}</code>
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
