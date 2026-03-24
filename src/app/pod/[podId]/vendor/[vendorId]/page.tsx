import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { prisma } from "@/lib/db";
import { AddToCartButton } from "./AddToCartButton";
import { getOrCreateCartAction } from "@/actions/cart.actions";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { getVendorAvailabilityStatus } from "@/lib/vendor-availability";

export default async function VendorMenuPage({
  params,
}: {
  params: Promise<{ podId: string; vendorId: string }>;
}) {
  const { podId, vendorId } = await params;
  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    include: {
      vendors: {
        where: { vendorId },
        include: {
          vendor: {
            include: {
              menuItems: {
                orderBy: { sortOrder: "asc" },
                include: {
                  modifierGroups: {
                    orderBy: { sortOrder: "asc" },
                    include: {
                      modifierGroup: {
                        include: {
                          options: {
                            orderBy: { sortOrder: "asc" },
                            include: {
                              nestedModifierGroups: {
                                include: {
                                  options: { orderBy: { sortOrder: "asc" } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  const pv = pod?.vendors[0];
  const vendor = pv?.vendor;
  if (!pod || !vendor) notFound();

  const cart = await getOrCreateCartAction(podId);
  const availabilityStatus = getVendorAvailabilityStatus(vendor);
  const unavailable = availabilityStatus !== "open";

  const menuItemsSorted = [...vendor.menuItems].sort((a, b) => {
    if (a.isAvailable === b.isAvailable) return a.sortOrder - b.sortOrder;
    return a.isAvailable ? -1 : 1;
  });

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/pod/${podId}`} className="text-mennyu-primary hover:underline">
          ← {pod.name}
        </Link>
      </div>
      {availabilityStatus === "closed" && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="status"
        >
          <p className="font-medium">This vendor is currently closed</p>
          <p className="mt-1 text-sm text-amber-800">You can still browse the menu.</p>
        </div>
      )}
      {availabilityStatus === "mennyu_paused" && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="status"
        >
          <p className="font-medium">This vendor is not accepting orders right now</p>
          <p className="mt-1 text-sm text-amber-800">You can still browse the menu.</p>
        </div>
      )}
      {availabilityStatus === "inactive" && (
        <div
          className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900"
          role="status"
        >
          <p className="font-medium">This vendor is not currently available</p>
          <p className="mt-1 text-sm text-amber-800">You can still browse the menu.</p>
        </div>
      )}
      <h1 className="text-2xl font-semibold">{vendor.name}</h1>
      {vendor.description && (
        <p className="mt-2 text-stone-600">{vendor.description}</p>
      )}
      {menuItemsSorted.length === 0 ? (
        <div className="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-8 text-center">
          <p className="text-stone-600">This vendor has no menu items available right now.</p>
          <p className="mt-1 text-sm text-stone-500">Check back later.</p>
          <Link href={`/pod/${podId}`} className="mt-4 inline-block text-mennyu-primary hover:underline">
            ← Back to {pod.name}
          </Link>
        </div>
      ) : (
      <div className="mt-8 space-y-6">
        {menuItemsSorted.map((item) => {
          const itemUnavailable = unavailable || !item.isAvailable;
          return (
          <div
            key={item.id}
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
                cartId={cart.id}
                menuItemId={item.id}
                menuItemName={item.name}
                priceCents={item.priceCents}
                modifierConfig={item.modifierGroups?.length ? serializeModifierConfig(item) : undefined}
                orderingDisabled={itemUnavailable}
              />
            </div>
          </div>
          );
        })}
      </div>
      )}
      {cart.items.length > 0 && (
        <div className="mt-8">
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
