"use client";

import Link from "next/link";
import { VendorMenuModifierProvider } from "@/components/vendor-menu/VendorMenuModifierContext";
import { PageShell } from "@/components/layout/page-shell";
import { VendorMenuCategoryNav } from "@/components/vendor-menu/VendorMenuCategoryNav";
import { VendorMenuItemCard } from "@/components/vendor-menu/VendorMenuItemCard";
import { VendorMenuMobileCartBar } from "@/components/vendor-menu/VendorMenuMobileCartBar";
import { partitionMenuSections } from "@/lib/vendor-menu-spotlight";
import { customerMenuCategoryDomId } from "@/lib/vendor-menu-category-id";
import type { CustomerVendorMenuCategorySection } from "@/services/vendor-customer-menu.service";
import { cn } from "@/lib/cn";
import { useVendorMenuCart } from "@/components/vendor-menu/VendorMenuCartContext";
import { VendorMenuCartMutationBanner } from "@/components/vendor-menu/VendorMenuCartMutationBanner";

export type VendorMenuExperienceClientProps = {
  podId: string;
  podName: string;
  vendorId: string;
  vendorName: string;
  vendorAccentColor: string | null;
  sections: CustomerVendorMenuCategorySection[];
  /** Serializable variant counts (from server Map). */
  variantChildCountByParentPlu: Record<string, number>;
  orderingDisabled: boolean;
  vendorUsesDeliverect: boolean;
};

function MenuSectionGrid({
  section,
  podId,
  vendorId,
  vendorName,
  orderingDisabled,
  vendorUsesDeliverect,
  vendorAccentColor,
  variantChildCountByParentPlu,
  compactGrid,
}: {
  section: CustomerVendorMenuCategorySection;
  podId: string;
  vendorId: string;
  vendorName: string;
  orderingDisabled: boolean;
  vendorUsesDeliverect: boolean;
  vendorAccentColor: string | null;
  variantChildCountByParentPlu: Record<string, number>;
  compactGrid?: boolean;
}) {
  const { cartId } = useVendorMenuCart();
  const sectionDomId = customerMenuCategoryDomId(section.id);

  return (
    <section
      id={sectionDomId}
      aria-labelledby={`heading-${sectionDomId}`}
      className="scroll-mt-36"
    >
      <h2
        id={`heading-${sectionDomId}`}
        className="mb-3 text-base font-bold tracking-tight text-oo-charcoal sm:text-lg"
        style={vendorAccentColor ? { borderLeftColor: vendorAccentColor } : undefined}
      >
        <span
          className={cn(
            vendorAccentColor && "border-l-[3px] pl-2.5",
            !vendorAccentColor && "pl-0"
          )}
        >
          {section.name}
        </span>
      </h2>
      <ul
        className={cn(
          "grid gap-3",
          compactGrid
            ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
        )}
      >
        {section.items.map((item) => (
          <li key={item.id} className="min-h-0">
            <VendorMenuItemCard
              item={item}
              cartId={cartId}
              podId={podId}
              vendorId={vendorId}
              vendorName={vendorName}
              orderingDisabled={orderingDisabled}
              vendorUsesDeliverect={vendorUsesDeliverect}
              variantChildMenuItemCount={
                item.deliverectPlu
                  ? variantChildCountByParentPlu[item.deliverectPlu.trim()] ?? 0
                  : 0
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function VendorMenuExperienceClient({
  podId,
  podName,
  vendorId,
  vendorName,
  vendorAccentColor,
  sections,
  variantChildCountByParentPlu,
  orderingDisabled,
  vendorUsesDeliverect,
}: VendorMenuExperienceClientProps) {
  const { spotlightSections, mainSections } = partitionMenuSections(sections);
  const navSections = [...spotlightSections, ...mainSections];
  const extraAnchors =
    spotlightSections.length > 0
      ? [{ id: "pod-menu-spotlight", label: "Popular" }]
      : [];

  return (
    <VendorMenuModifierProvider>
      <VendorMenuCartMutationBanner />
      <div className="border-b border-oo-light-stone bg-oo-cream/80">
        <PageShell className="py-6 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
            <VendorMenuCategoryNav
              sections={navSections}
              vendorAccentColor={vendorAccentColor}
              extraAnchors={extraAnchors}
            />

            <div className="min-w-0 flex-1 space-y-8 pb-24 lg:pb-8">
              {spotlightSections.length > 0 && (
                <section
                  id="pod-menu-spotlight"
                  aria-labelledby="pod-menu-spotlight-heading"
                  className="scroll-mt-36"
                >
                  <header className="mb-3">
                    <h2
                      id="pod-menu-spotlight-heading"
                      className="text-base font-bold tracking-tight text-oo-charcoal sm:text-lg"
                    >
                      Popular at {vendorName}
                    </h2>
                    <p className="mt-0.5 text-sm text-oo-stone-gray">
                      Highlights from this kitchen — still part of your shared pod cart.
                    </p>
                  </header>
                  <div className="space-y-6">
                    {spotlightSections.map((section) => (
                      <MenuSectionGrid
                        key={section.id}
                        section={section}
                        podId={podId}
                        vendorId={vendorId}
                        vendorName={vendorName}
                        orderingDisabled={orderingDisabled}
                        vendorUsesDeliverect={vendorUsesDeliverect}
                        vendorAccentColor={vendorAccentColor}
                        variantChildCountByParentPlu={variantChildCountByParentPlu}
                        compactGrid
                      />
                    ))}
                  </div>
                </section>
              )}

              {mainSections.length === 0 && spotlightSections.length === 0 ? (
                <div className="oo-empty-state">
                  <p className="font-medium text-oo-charcoal">No menu items available right now</p>
                  <p className="mt-2 text-sm text-oo-stone-gray">Check back later.</p>
                  <Link
                    href={`/pod/${podId}`}
                    className="mt-4 inline-block text-sm font-semibold text-oo-charcoal hover:underline"
                  >
                    Back to {podName}
                  </Link>
                </div>
              ) : (
                <div className="space-y-8">
                  {mainSections.map((section) => (
                    <MenuSectionGrid
                      key={section.id}
                      section={section}
                      podId={podId}
                      vendorId={vendorId}
                      vendorName={vendorName}
                      orderingDisabled={orderingDisabled}
                      vendorUsesDeliverect={vendorUsesDeliverect}
                      vendorAccentColor={vendorAccentColor}
                      variantChildCountByParentPlu={variantChildCountByParentPlu}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </PageShell>
      </div>

      <VendorMenuMobileCartBar />
    </VendorMenuModifierProvider>
  );
}
