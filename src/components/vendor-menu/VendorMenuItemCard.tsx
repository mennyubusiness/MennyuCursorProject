"use client";

import { MenuItemImage } from "@/components/images/MenuItemImage";
import { AddToCartButton } from "@/app/pod/[podId]/vendor/[vendorId]/AddToCartButton";
import type { CustomerVendorMenuItem } from "@/services/vendor-customer-menu.service";
import { serializeModifierConfig } from "@/lib/modifier-config";
import { cn } from "@/lib/cn";
import {
  handleMenuItemCardKeyDown,
  useMenuItemAddAction,
} from "@/components/vendor-menu/useMenuItemAddAction";

type VendorMenuItemCardProps = {
  item: CustomerVendorMenuItem;
  cartId: string;
  podId: string;
  vendorId: string;
  vendorName: string;
  /** Ordering is blocked for a temporary reason (closed, paused, setup incomplete). */
  orderingDisabled: boolean;
  /**
   * Vendor or pod is menu-only. Ordering controls are removed entirely rather than disabled,
   * and the card keeps its normal appearance — menu-only is not sold out.
   */
  menuOnly?: boolean;
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
  menuOnly = false,
  vendorUsesDeliverect,
  variantChildMenuItemCount = 0,
}: VendorMenuItemCardProps) {
  /** Sold out comes from item data only, never from ordering mode. */
  const itemUnavailable = !item.isAvailable;
  /** Menu-only removes the ordering affordances; other blocks keep the dimmed disabled look. */
  const dimmed = menuOnly ? itemUnavailable : orderingDisabled || itemUnavailable;
  const interactive = !menuOnly && !orderingDisabled && !itemUnavailable;
  const modifierConfig = item.modifierGroups?.length
    ? serializeModifierConfig(item, { variantChildMenuItemCount })
    : undefined;

  const addAction = useMenuItemAddAction({
    menuItemId: item.id,
    shellDeliverectPlu: item.deliverectPlu,
    modifierConfig,
    podId,
    vendorId,
    vendorName,
    menuItemName: item.name,
    unitPriceCents: item.priceCents,
    orderingDisabled: !interactive,
    vendorUsesDeliverect,
    menuItemDeliverectVariantParentPlu: item.deliverectVariantParentPlu,
  });

  const cardActivateLabel = modifierConfig
    ? `Customize ${item.name}`
    : `Add ${item.name} to cart`;

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-oo-light-stone bg-oo-warm-white shadow-sm transition duration-200",
        interactive &&
          "hover:-translate-y-0.5 hover:border-stone-400 hover:shadow-md motion-reduce:hover:translate-y-0",
        dimmed && "opacity-80"
      )}
    >
      <div
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? cardActivateLabel : undefined}
        aria-disabled={dimmed || undefined}
        onClick={interactive ? addAction.triggerAddFlow : undefined}
        onKeyDown={(event) =>
          handleMenuItemCardKeyDown(event, addAction.triggerAddFlow, !interactive)
        }
        className={cn(
          "flex min-h-0 flex-1 flex-col text-left outline-none",
          interactive &&
            "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.995] motion-reduce:active:scale-100"
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

          {itemUnavailable && (
            <span className="absolute left-2 top-2 z-10 rounded-md bg-oo-charcoal/80 px-2 py-1 text-xs font-bold uppercase tracking-wide text-oo-warm-white">
              Unavailable
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-3.5">
          <h3 className="line-clamp-2 text-base font-semibold leading-snug text-oo-charcoal">
            {item.name}
          </h3>
          {item.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-oo-stone-gray">
              {item.description}
            </p>
          )}
          <p className="mt-2 text-base font-bold tabular-nums text-oo-charcoal">
            ${(item.priceCents / 100).toFixed(2)}
          </p>
        </div>
      </div>

      {menuOnly ? null : (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 flex aspect-[16/9] items-end justify-end p-2.5 sm:p-3"
          aria-hidden={!interactive}
        >
          <div className="pointer-events-auto">
            <AddToCartButton
              cartId={cartId}
              menuItemId={item.id}
              shellDeliverectPlu={item.deliverectPlu}
              podId={podId}
              vendorId={vendorId}
              vendorName={vendorName}
              menuItemName={item.name}
              unitPriceCents={item.priceCents}
              modifierConfig={modifierConfig}
              orderingDisabled={!interactive}
              vendorUsesDeliverect={vendorUsesDeliverect}
              menuItemDeliverectVariantParentPlu={item.deliverectVariantParentPlu}
              displayMode="card-overlay"
              addAction={addAction}
            />
          </div>
        </div>
      )}
    </article>
  );
}
