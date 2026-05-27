import { MenuItemImage } from "@/components/images/MenuItemImage";
import type { CustomerVendorMenuItem } from "@/services/vendor-customer-menu.service";
import type { CartItem } from "@/domain/types";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { AddToCartButton } from "@/app/pod/[podId]/vendor/[vendorId]/AddToCartButton";
import { cn } from "@/lib/cn";

type VendorMenuItemCardProps = {
  item: CustomerVendorMenuItem;
  cartId: string;
  podId: string;
  vendorId: string;
  vendorCartItems: CartItem[];
  orderingDisabled: boolean;
  vendorUsesDeliverect: boolean;
};

export function VendorMenuItemCard({
  item,
  cartId,
  podId,
  vendorId,
  vendorCartItems,
  orderingDisabled,
  vendorUsesDeliverect,
}: VendorMenuItemCardProps) {
  const itemUnavailable = orderingDisabled || !item.isAvailable;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden oo-card-hover",
        !item.isAvailable && "opacity-80"
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100">
        <div className="absolute inset-0">
          <MenuItemImage
            imageUrl={item.imageUrl}
            itemName={item.name}
            className="!h-full !w-full !rounded-none !border-0"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 320px"
          />
        </div>

        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
          aria-hidden
        />

        {!item.isAvailable && (
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/75 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            Unavailable
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-end p-2 sm:p-2.5">
          <AddToCartButton
            cartId={cartId}
            menuItemId={item.id}
            shellDeliverectPlu={item.deliverectPlu}
            podId={podId}
            vendorId={vendorId}
            vendorCartItems={vendorCartItems}
            modifierConfig={item.modifierGroups?.length ? serializeModifierConfig(item) : undefined}
            orderingDisabled={itemUnavailable}
            vendorUsesDeliverect={vendorUsesDeliverect}
            menuItemDeliverectVariantParentPlu={item.deliverectVariantParentPlu}
            displayMode="card-overlay"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-2.5 sm:p-3">
        <h3 className="line-clamp-1 text-sm font-semibold text-black">{item.name}</h3>
        {item.description && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-600">{item.description}</p>
        )}
        <p className="mt-1.5 text-sm font-bold tabular-nums text-black">
          ${(item.priceCents / 100).toFixed(2)}
        </p>
      </div>
    </article>
  );
}
