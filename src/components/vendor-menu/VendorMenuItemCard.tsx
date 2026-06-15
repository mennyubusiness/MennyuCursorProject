import { MenuItemImage } from "@/components/images/MenuItemImage";
import type { CustomerVendorMenuItem } from "@/services/vendor-customer-menu.service";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { AddToCartButton } from "@/app/pod/[podId]/vendor/[vendorId]/AddToCartButton";
import { cn } from "@/lib/cn";

type VendorMenuItemCardProps = {
  item: CustomerVendorMenuItem;
  cartId: string;
  podId: string;
  vendorId: string;
  vendorName: string;
  orderingDisabled: boolean;
  vendorUsesDeliverect: boolean;
  variantChildMenuItemCount?: number;
};

export function VendorMenuItemCard({
  item,
  cartId,
  podId,
  vendorId,
  vendorName,
  orderingDisabled,
  vendorUsesDeliverect,
  variantChildMenuItemCount = 0,
}: VendorMenuItemCardProps) {
  const itemUnavailable = orderingDisabled || !item.isAvailable;

  return (
    <article
      className={cn(
        "group flex h-full flex-col overflow-hidden oo-card-hover",
        !item.isAvailable && "opacity-80"
      )}
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-oo-cream">
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
          <span className="absolute left-2 top-2 z-10 rounded-md bg-oo-charcoal/80 px-2 py-1 text-xs font-bold uppercase tracking-wide text-oo-warm-white">
            Unavailable
          </span>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 flex justify-end p-2.5 sm:p-3">
          <AddToCartButton
            cartId={cartId}
            menuItemId={item.id}
            shellDeliverectPlu={item.deliverectPlu}
            podId={podId}
            vendorId={vendorId}
            vendorName={vendorName}
            menuItemName={item.name}
            unitPriceCents={item.priceCents}
            modifierConfig={
              item.modifierGroups?.length
                ? serializeModifierConfig(item, { variantChildMenuItemCount })
                : undefined
            }
            orderingDisabled={itemUnavailable}
            vendorUsesDeliverect={vendorUsesDeliverect}
            menuItemDeliverectVariantParentPlu={item.deliverectVariantParentPlu}
            displayMode="card-overlay"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-oo-charcoal">{item.name}</h3>
        {item.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-oo-stone-gray">{item.description}</p>
        )}
        <p className="mt-2 text-base font-bold tabular-nums text-oo-charcoal">
          ${(item.priceCents / 100).toFixed(2)}
        </p>
      </div>
    </article>
  );
}
