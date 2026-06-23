import type { Cart } from "@/domain/types";
import type { CustomerVendorMenuCategorySection } from "@/services/vendor-customer-menu.service";
import { VendorMenuCartProvider } from "@/components/vendor-menu/VendorMenuCartContext";
import { VendorMenuExperienceClient } from "@/components/vendor-menu/VendorMenuExperienceClient";

type VendorMenuExperienceProps = {
  podId: string;
  podSlug: string;
  podName: string;
  vendorId: string;
  vendorSlug: string;
  vendorName: string;
  vendorAccentColor: string | null;
  sections: CustomerVendorMenuCategorySection[];
  variantChildCountByParentPlu: Map<string, number>;
  cart: Cart;
  orderingDisabled: boolean;
  vendorUsesDeliverect: boolean;
};

/**
 * Server-safe shell: provides cart context and renders the client menu UI.
 * Hooks (useVendorMenuCart) live only in VendorMenuExperienceClient and descendants.
 */
export function VendorMenuExperience({
  cart,
  vendorId,
  variantChildCountByParentPlu,
  ...clientProps
}: VendorMenuExperienceProps) {
  const variantCounts = Object.fromEntries(variantChildCountByParentPlu);

  return (
    <VendorMenuCartProvider initialCart={cart} vendorId={vendorId}>
      <VendorMenuExperienceClient
        {...clientProps}
        vendorId={vendorId}
        variantChildCountByParentPlu={variantCounts}
      />
    </VendorMenuCartProvider>
  );
}
