import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { assertCartSessionAccess } from "@/lib/cart-session-access";
import { getMennyuSessionIdForRequest } from "@/lib/session-request";
import { prisma } from "@/lib/db";
import { prepareGroupOrderCheckoutForHost } from "@/services/group-order.service";
import { CART_DISPLAY_SESSION_CART_INCLUDE, CHECKOUT_SUMMARY_CART_INCLUDE } from "@/services/cart.service";
import { buildCartForValidationFromDisplayCart } from "@/lib/cart-for-validation";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutOrderSummary } from "./CheckoutOrderSummary";
import { CheckoutProgress } from "./CheckoutProgress";
import { computeOrderPricing } from "@/domain/fees";
import { getActivePricingRatesSnapshot } from "@/services/pricing-config.service";
import { getUserLinkedVerifiedPhoneAccount } from "@/lib/customer-checkout-phone-verification";
import { hasTransactionalSmsConsent } from "@/lib/sms-opt-out.service";
import { formatUsPhoneDisplayFromE164 } from "@/lib/phone-e164";
import { getCheckoutDefaultScheduledPickup, validateCartItemsForDisplay } from "@/services/order.service";
import {
  getParentShellInfoByVendorParentPlu,
  getVariantOptionDisplayNamesForLeafLines,
  shellBasePriceKey,
  variantLeafDisplayKey,
} from "@/services/cart-deliverect-variant-resolution";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ cartId?: string }>;
}) {
  const loadStarted = process.env.NODE_ENV === "development" ? Date.now() : 0;
  const { cartId } = await searchParams;
  if (!cartId) redirect("/cart");

  const [sessionId, authSession] = await Promise.all([
    getMennyuSessionIdForRequest(),
    auth(),
  ]);

  const access = await assertCartSessionAccess(cartId, sessionId ?? null, {
    authUserId: authSession?.user?.id ?? null,
    mode: "checkout",
  });
  if (!access.ok) {
    const errorCode = access.error.includes("host") ? "group_checkout_host_only" : "cart_access_denied";
    redirect(`/cart?error=${encodeURIComponent(errorCode)}`);
  }

  const groupSessionMeta = access.isGroupOrder
    ? await prisma.groupOrderSession.findUnique({
        where: { cartId },
        select: { id: true, hostUserId: true, status: true },
      })
    : null;

  let groupCheckoutFingerprint: string | undefined;

  if (groupSessionMeta) {
    const lockResult = await prepareGroupOrderCheckoutForHost(cartId, groupSessionMeta.hostUserId);
    if (!lockResult.ok) {
      redirect(`/cart?error=${encodeURIComponent(lockResult.code)}`);
    }
    groupCheckoutFingerprint = lockResult.checkoutFingerprint;
  }

  let cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: CHECKOUT_SUMMARY_CART_INCLUDE,
  });
  if (!cart || cart.items.length === 0) redirect("/cart");

  if (!access.isGroupOrder && cart.sessionId !== (sessionId ?? "")) {
    redirect("/cart");
  }

  const validationCart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: CART_DISPLAY_SESSION_CART_INCLUDE,
  });
  if (validationCart && validationCart.items.length > 0) {
    const validation = await validateCartItemsForDisplay(
      buildCartForValidationFromDisplayCart(validationCart)
    );
    if (!validation.valid && validation.errors.length > 0) {
      const code = validation.errors[0]?.code ?? "CART_INVALID";
      redirect(`/cart?error=${encodeURIComponent(code)}`);
    }
  }

  const [parentShellByVendorParentPlu, variantDisplayNames, { rates }] = await Promise.all([
    getParentShellInfoByVendorParentPlu(cart.items),
    getVariantOptionDisplayNamesForLeafLines(
      cart.items.map((item) => ({
        vendorId: item.vendorId,
        deliverectVariantParentPlu: item.menuItem.deliverectVariantParentPlu,
        deliverectPlu: item.menuItem.deliverectPlu,
      }))
    ),
    getActivePricingRatesSnapshot(),
  ]);

  const checkoutLineNameByItemId = new Map<string, string>();
  for (const item of cart.items) {
    const pplu = item.menuItem.deliverectVariantParentPlu?.trim();
    if (!pplu) {
      checkoutLineNameByItemId.set(item.id, item.menuItem.name);
      continue;
    }
    const parent = parentShellByVendorParentPlu.get(shellBasePriceKey(item.vendorId, pplu));
    const leafKey = variantLeafDisplayKey(
      item.vendorId,
      item.menuItem.deliverectVariantParentPlu,
      item.menuItem.deliverectPlu
    );
    const size = leafKey ? variantDisplayNames.get(leafKey) : undefined;
    const base = parent?.name ?? item.menuItem.name;
    checkoutLineNameByItemId.set(item.id, size ? `${base} · ${size}` : base);
  }

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
  const itemCount = cart.items.reduce((n, item) => n + item.quantity, 0);
  const dueBeforeTipCents = totals.subtotalCents + totals.serviceFeeCents + totals.taxCents;
  const vendorGroups = Array.from(byVendor.entries()).map(([vendorId, g]) => ({
    vendorId,
    vendorName: g.name,
    lines: g.lines,
  }));
  const scheduledDefaults = getCheckoutDefaultScheduledPickup(cart.pod);

  const signedInUserId = authSession?.user?.id ?? null;
  const linkedVerifiedPhone = signedInUserId
    ? await getUserLinkedVerifiedPhoneAccount(signedInUserId)
    : null;
  const accountVerifiedPhoneE164 = linkedVerifiedPhone?.phoneE164 ?? null;
  const initialPhone = accountVerifiedPhoneE164
    ? formatUsPhoneDisplayFromE164(accountVerifiedPhoneE164)
    : "";
  const initialSmsConsent = accountVerifiedPhoneE164
    ? await hasTransactionalSmsConsent(accountVerifiedPhoneE164)
    : false;

  if (process.env.NODE_ENV === "development") {
    console.log("[checkout-load]", {
      cartId: cart.id,
      itemCount: cart.items.length,
      ms: Date.now() - loadStarted,
    });
  }

  return (
    <div className="mx-auto max-w-2xl bg-oo-cream px-1 sm:bg-transparent sm:px-0 sm:pb-10">
      <CheckoutProgress activeStep={2} className="pt-3 sm:pt-4" />
      <div className="mb-2">
        <Link
          href={groupSessionMeta ? "/cart?groupUnlock=1" : "/cart"}
          className="text-sm font-medium text-oo-stone-gray hover:text-oo-charcoal hover:underline"
        >
          ← Back to cart
        </Link>
      </div>
      <header className="border-b border-oo-light-stone pb-4">
        <h1 className="text-2xl font-bold text-oo-charcoal">Checkout</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-oo-stone-gray sm:text-base">
          Review your order, add payment, and place your pickup order.
        </p>
        {groupSessionMeta ? (
          <p className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm text-sky-950">
            Group checkout is locked while you pay. Return to cart to make changes.
          </p>
        ) : null}
        <p className="mt-2 text-sm text-oo-stone-gray">
          <span className="font-semibold text-oo-charcoal">{cart.pod.name}</span>
          {vendorCount > 1 ? (
            <span className="text-oo-stone-gray"> · {vendorCount} vendors</span>
          ) : null}
        </p>
      </header>

      <div className="mt-6">
        <CheckoutOrderSummary
          vendorGroups={vendorGroups}
          itemCount={itemCount}
          vendorCount={vendorCount}
          subtotalCents={totals.subtotalCents}
          serviceFeeCents={totals.serviceFeeCents}
          serviceFeePercentLabel={serviceFeePercentLabel}
          taxCents={totals.taxCents}
          dueBeforeTipCents={dueBeforeTipCents}
        />
      </div>

      <CheckoutForm
        cartId={cart.id}
        podId={cart.podId}
        itemCount={itemCount}
        totalCents={totals.totalCents}
        subtotalCents={totals.subtotalCents}
        serviceFeeCents={totals.serviceFeeCents}
        taxCents={totals.taxCents}
        pickupTimezoneLabel={scheduledDefaults.timezone}
        defaultScheduledDate={scheduledDefaults.date}
        defaultScheduledTime={scheduledDefaults.time}
        isSignedIn={Boolean(signedInUserId)}
        accountVerifiedPhoneE164={accountVerifiedPhoneE164}
        initialPhone={initialPhone}
        initialSmsConsent={initialSmsConsent}
        groupCheckoutFingerprint={groupCheckoutFingerprint}
      />
    </div>
  );
}
