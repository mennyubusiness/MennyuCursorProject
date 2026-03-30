import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { VendorLogo } from "@/components/images/VendorLogo";
import { prisma } from "@/lib/db";
import {
  customerMenuCategoryDomId,
  loadCustomerVendorMenuSections,
  type CustomerVendorMenuItem,
} from "@/services/vendor-customer-menu.service";
import { AddToCartButton } from "./AddToCartButton";
import { getOrCreateCartAction } from "@/actions/cart.actions";
import { serializeModifierConfig } from "@/lib/modifier-config";
import {
  getVendorAvailabilityStatus,
  type VendorAvailabilityStatus,
} from "@/lib/vendor-availability";
import type { CartItem } from "@/domain/types";

function VendorStatusBadge({ status }: { status: VendorAvailabilityStatus }) {
  if (status === "open") {
    return (
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-900">
        Open
      </span>
    );
  }
  const label =
    status === "closed"
      ? "Closed"
      : status === "mennyu_paused"
        ? "Not accepting orders"
        : "Unavailable";
  return (
    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
      {label}
    </span>
  );
}

function availabilityBannerCopy(status: VendorAvailabilityStatus): string | null {
  if (status === "open") return null;
  if (status === "closed") return "This vendor is currently closed.";
  if (status === "mennyu_paused") return "This vendor is not accepting orders right now.";
  return "This vendor is not currently available.";
}

function MenuItemRow({
  item,
  cartId,
  podId,
  vendorId,
  vendorCartItems,
  orderingDisabled,
}: {
  item: CustomerVendorMenuItem;
  cartId: string;
  podId: string;
  vendorId: string;
  vendorCartItems: CartItem[];
  orderingDisabled: boolean;
}) {
  const itemUnavailable = orderingDisabled || !item.isAvailable;
  return (
    <div
      className={`flex flex-col gap-4 rounded-lg border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5 ${!item.isAvailable ? "opacity-75" : ""}`}
    >
      <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
        <MenuItemImage
          imageUrl={item.imageUrl}
          itemName={item.name}
          className="h-16 w-16 shrink-0 sm:h-20 sm:w-20"
        />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-stone-900">
            {item.name}
            {!item.isAvailable && (
              <span className="ml-2 rounded bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-700">
                Unavailable
              </span>
            )}
          </h3>
          {item.description && (
            <p className="mt-1 text-sm text-stone-600">{item.description}</p>
          )}
          <p className="mt-2 text-sm font-medium text-mennyu-primary">
            ${(item.priceCents / 100).toFixed(2)}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 justify-end sm:justify-center">
        <AddToCartButton
          cartId={cartId}
          menuItemId={item.id}
          podId={podId}
          vendorId={vendorId}
          vendorCartItems={vendorCartItems}
          modifierConfig={item.modifierGroups?.length ? serializeModifierConfig(item) : undefined}
          orderingDisabled={itemUnavailable}
        />
      </div>
    </div>
  );
}

export default async function VendorMenuPage({
  params,
}: {
  params: Promise<{ podId: string; vendorId: string }>;
}) {
  const { podId, vendorId } = await params;
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      accentColor: true,
      vendors: {
        where: { vendorId },
        include: {
          vendor: true,
        },
      },
    },
  });
  const pv = pod?.vendors[0];
  const vendor = pv?.vendor;
  if (!pod || !vendor) notFound();

  const [{ sections }, cart] = await Promise.all([
    loadCustomerVendorMenuSections(vendorId),
    getOrCreateCartAction(podId),
  ]);

  const availabilityStatus = getVendorAvailabilityStatus(vendor);
  const unavailable = availabilityStatus !== "open";
  const bannerLine = availabilityBannerCopy(availabilityStatus);
  const vendorCartItems = cart.items.filter((i) => i.vendorId === vendorId);

  const showCategoryJump = sections.length > 1;

  return (
    <div>
      <nav
        className="mb-8 border-b border-stone-100 pb-3 text-xs text-stone-500"
        aria-label="Breadcrumb"
        style={
          pod.accentColor
            ? { borderBottomColor: pod.accentColor, borderBottomWidth: 1 }
            : undefined
        }
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link
              href={`/pod/${podId}`}
              className="font-medium hover:underline"
              style={pod.accentColor ? { color: pod.accentColor } : undefined}
            >
              {pod.name}
            </Link>
          </li>
          <li aria-hidden className="text-stone-300">
            /
          </li>
          <li className="font-medium text-stone-600">{vendor.name}</li>
        </ol>
      </nav>

      <header
        className="border-b border-stone-200 pb-8"
        style={
          vendor.accentColor
            ? { borderBottomWidth: 2, borderBottomColor: vendor.accentColor }
            : undefined
        }
      >
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
          <VendorLogo
            imageUrl={vendor.imageUrl}
            vendorName={vendor.name}
            className="h-28 w-28 shrink-0 sm:h-36 sm:w-36"
            sizes="(max-width: 640px) 112px, 144px"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900 sm:text-4xl">
                {vendor.name}
              </h1>
              <VendorStatusBadge status={availabilityStatus} />
            </div>
            {vendor.description && (
              <p className="mt-3 max-w-2xl text-base text-stone-600">{vendor.description}</p>
            )}
          </div>
        </div>
      </header>

      {bannerLine && (
        <div
          className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="status"
        >
          <p className="font-medium">{bannerLine}</p>
          <p className="mt-1 text-sm text-amber-800">You can still browse the menu.</p>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="mt-10 rounded-xl border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-600">This vendor has no menu items available right now.</p>
          <p className="mt-1 text-sm text-stone-500">Check back later.</p>
          <Link href={`/pod/${podId}`} className="mt-4 inline-block text-sm text-mennyu-primary hover:underline">
            Back to {pod.name}
          </Link>
        </div>
      ) : (
        <>
          {showCategoryJump && (
            <nav
              className="mt-8 flex flex-wrap gap-2 border-b border-stone-200 pb-4"
              aria-label="Jump to menu category"
            >
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${customerMenuCategoryDomId(s.id)}`}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm hover:border-mennyu-primary/40 hover:text-mennyu-primary"
                  style={
                    vendor.accentColor
                      ? { borderColor: vendor.accentColor }
                      : undefined
                  }
                >
                  {s.name}
                </a>
              ))}
            </nav>
          )}

          <div className="mt-8 space-y-10">
            {sections.map((section) => (
              <section
                key={section.id}
                id={customerMenuCategoryDomId(section.id)}
                aria-labelledby={`heading-${customerMenuCategoryDomId(section.id)}`}
                className="scroll-mt-24"
              >
                <h2
                  id={`heading-${customerMenuCategoryDomId(section.id)}`}
                  className="border-l-4 border-stone-200 pl-3 text-lg font-semibold text-stone-900"
                  style={
                    vendor.accentColor ? { borderLeftColor: vendor.accentColor } : undefined
                  }
                >
                  {section.name}
                </h2>
                <div className="mt-4 space-y-4">
                  {section.items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      cartId={cart.id}
                      podId={podId}
                      vendorId={vendorId}
                      vendorCartItems={vendorCartItems}
                      orderingDisabled={unavailable}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {cart.items.length > 0 && (
        <div className="mt-10">
          <Link
            href="/cart"
            className="inline-block rounded-lg bg-mennyu-primary px-4 py-2 font-medium text-black hover:bg-mennyu-secondary"
          >
            View cart ({cart.items.length} items)
          </Link>
        </div>
      )}
    </div>
  );
}
