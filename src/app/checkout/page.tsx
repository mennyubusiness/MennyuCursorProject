import Link from "next/link";
import { redirect } from "next/navigation";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutProgress } from "./CheckoutProgress";
import { computeOrderPricing } from "@/domain/fees";
import { getActivePricingRatesSnapshot } from "@/services/pricing-config.service";
import { getCheckoutDefaultScheduledPickup, validateCartForOrder } from "@/services/order.service";
import {
  getParentShellInfoByVendorParentPlu,
  getVariantOptionDisplayNameForLeaf,
  shellBasePriceKey,
} from "@/services/cart-deliverect-variant-resolution";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cartId?: string }>;
}) {
  const { cartId } = await searchParams;
  if (!cartId) redirect("/cart");

  const sessionId = (await getMennyuSessionIdForRequest()) ?? "";
  const cart = await prisma.cart.findFirst({
    where: { id: cartId, sessionId },
    include: {
      items: {
        include: {
          menuItem: true,
          vendor: true,
          selections: { include: { modifierOption: true } },
        },
      },
      pod: true,
    },
  });
  if (!cart || cart.items.length === 0) redirect("/cart");

  const validation = await validateCartForOrder({
    podId: cart.podId,
    items: cart.items.map((i) => ({
      id: i.id,
      menuItemId: i.menuItemId,
      vendorId: i.vendorId,
      quantity: i.quantity,
      priceCents: i.priceCents,
      menuItem: {
        priceCents: i.menuItem.priceCents,
        isAvailable: i.menuItem.isAvailable,
        name: i.menuItem.name,
        basketMaxQuantity: i.menuItem.basketMaxQuantity ?? null,
        deliverectProductId: i.menuItem.deliverectProductId ?? null,
        deliverectPlu: i.menuItem.deliverectPlu ?? null,
        deliverectVariantParentPlu: i.menuItem.deliverectVariantParentPlu ?? null,
      },
      vendor: {
        isActive: i.vendor.isActive,
        mennyuOrdersPaused: i.vendor.mennyuOrdersPaused ?? undefined,
        posOpen: undefined,
        deliverectChannelLinkId: i.vendor.deliverectChannelLinkId ?? null,
      },
      selections: i.selections?.map((s) => ({
        modifierOptionId: s.modifierOptionId,
        quantity: s.quantity,
        modifierOption: { priceCents: s.modifierOption.priceCents },
      })),
    })),
  });
  if (!validation.valid) {
    redirect(`/cart?error=${encodeURIComponent(validation.code)}`);
  }

  const parentShellByVendorParentPlu = await getParentShellInfoByVendorParentPlu(cart.items);
  const checkoutLineNameByItemId = new Map<string, string>();
  await Promise.all(
    cart.items.map(async (item) => {
      const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
      if (!pplu) {
        checkoutLineNameByItemId.set(item.id, item.menuItem.name);
        return;
      }
      const parent = parentShellByVendorParentPlu.get(shellBasePriceKey(item.vendorId, pplu));
      const size = await getVariantOptionDisplayNameForLeaf(
        item.vendorId,
        item.menuItem.deliverectVariantParentPlu,
        item.menuItem.deliverectPlu
      );
      const base = parent?.name ?? item.menuItem.name;
      checkoutLineNameByItemId.set(item.id, size ? `${base} · ${size}` : base);
    })
  );

  const byVendor = new Map<
    string,
    { name: string; lines: Array<{ name: string; qty: number; cents: number }> }
  >();
  for (const item of cart.items) {
    const lineCents = item.priceCents * item.quantity;
    const g = byVendor.get(item.vendorId);
    const line = {
      name: checkoutLineNameByItemId.get(item.id) ?? item.menuItem.name,
      qty: item.quantity,
      cents: lineCents,
    };
    if (g) {
      g.lines.push(line);
    } else {
      byVendor.set(item.vendorId, { name: item.vendor.name, lines: [line] });
    }
  }
  const vendorSubtotalsCents = Array.from(byVendor.values()).map((g) =>
    g.lines.reduce((a, l) => a + l.cents, 0)
  );
  const { rates } = await getActivePricingRatesSnapshot();
  const totals = computeOrderPricing(
    {
      vendorSubtotalsCents,
      tipCents: 0,
      pickupSalesTaxBps: cart.pod.pickupSalesTaxBps,
    },
    rates
  );
  const serviceFeePercentLabel = `${(rates.customerServiceFeeBps / 100).toFixed(2)}%`;
  const vendorCount = byVendor.size;
  const scheduledDefaults = getCheckoutDefaultScheduledPickup(cart.pod);

  return (
    <div className="mx-auto max-w-2xl">
      <CheckoutProgress activeStep={2} />
      <div className="mb-2">
        <Link
          href={`/cart`}
          className="text-sm font-medium text-stone-600 hover:text-stone-900 hover:underline"
        >
          ← Back to cart
        </Link>
      </div>
      <header className="border-b border-stone-200 pb-4">
        <h1 className="text-2xl font-semibold text-stone-900">Checkout</h1>
        <p className="mt-1 text-stone-600">
          <span className="font-medium text-stone-800">{cart.pod.name}</span>
          {vendorCount > 1 && (
            <span className="text-stone-500"> · {vendorCount} vendors</span>
          )}
        </p>
      </header>

      <section className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Order summary
          </h2>
        </div>
        <div className="divide-y divide-stone-100 px-4 py-2">
          {Array.from(byVendor.entries()).map(([vid, g]) => (
            <div key={vid} className="py-4 first:pt-2 last:pb-2">
              <p className="font-medium text-stone-900">{g.name}</p>
              <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
                {g.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span className="min-w-0">
                      {l.name}
                      <span className="text-stone-400"> × {l.qty}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      ${(l.cents / 100).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <dl className="space-y-2 border-t border-stone-100 bg-stone-50/80 px-4 py-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Food subtotal</dt>
            <dd className="tabular-nums font-medium text-stone-900">
              ${(totals.subtotalCents / 100).toFixed(2)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-stone-600">Service fee ({serviceFeePercentLabel})</dt>
            <dd className="tabular-nums text-stone-800">
              ${(totals.serviceFeeCents / 100).toFixed(2)}
            </dd>
          </div>
          {totals.taxCents > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-stone-600">Sales tax (pickup)</dt>
              <dd className="tabular-nums text-stone-800">
                ${(totals.taxCents / 100).toFixed(2)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-stone-200 pt-2 text-base">
            <dt className="font-semibold text-stone-900">Due before tip</dt>
            <dd className="tabular-nums font-bold text-stone-900">
              ${((totals.subtotalCents + totals.serviceFeeCents + totals.taxCents) / 100).toFixed(2)}
            </dd>
          </div>
        </dl>
      </section>

      <p className="mt-4 text-sm text-stone-500">
        Add your contact info and tip below, then pay securely. Your order is placed and sent to
        vendors only after payment succeeds.
      </p>

      <CheckoutForm
        cartId={cart.id}
        totalCents={totals.totalCents}
        subtotalCents={totals.subtotalCents}
        serviceFeeCents={totals.serviceFeeCents}
        taxCents={totals.taxCents}
        pickupTimezoneLabel={scheduledDefaults.timezone}
        defaultScheduledDate={scheduledDefaults.date}
        defaultScheduledTime={scheduledDefaults.time}
      />
    </div>
  );
}
