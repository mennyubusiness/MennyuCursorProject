import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionIdFromHeaders } from "@/lib/session";
import { prisma } from "@/lib/db";
import { CheckoutForm } from "./CheckoutForm";
import { computeOrderTotals } from "@/domain/fees";
import { validateCartForOrder } from "@/services/order.service";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cartId?: string }>;
}) {
  const { cartId } = await searchParams;
  if (!cartId) redirect("/cart");

  const headersList = await headers();
  const sessionId = getSessionIdFromHeaders(headersList) ?? "";
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
      },
      vendor: {
        isActive: i.vendor.isActive,
        mennyuOrdersPaused: i.vendor.mennyuOrdersPaused ?? undefined,
        posOpen: undefined,
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

  const byVendor = new Map<string, number>();
  for (const item of cart.items) {
    const sub = item.priceCents * item.quantity;
    byVendor.set(item.vendorId, (byVendor.get(item.vendorId) ?? 0) + sub);
  }
  const vendorSubtotalsCents = Array.from(byVendor.values());
  const totals = computeOrderTotals({
    vendorSubtotalsCents,
    tipCents: 0,
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-stone-900">Checkout</h1>
      <p className="mt-1 text-stone-600">{cart.pod.name}</p>

      <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-stone-600">Subtotal: ${(totals.subtotalCents / 100).toFixed(2)}</p>
        <p className="text-stone-600">
          Service fee (3.5%): ${(totals.serviceFeeCents / 100).toFixed(2)}
        </p>
        <p className="font-medium text-stone-900">
          Total (before tip): ${((totals.subtotalCents + totals.serviceFeeCents) / 100).toFixed(2)}
        </p>
      </div>

      <CheckoutForm
        cartId={cart.id}
        podId={cart.podId}
        totalCents={totals.totalCents}
        subtotalCents={totals.subtotalCents}
        serviceFeeCents={totals.serviceFeeCents}
      />
    </div>
  );
}
