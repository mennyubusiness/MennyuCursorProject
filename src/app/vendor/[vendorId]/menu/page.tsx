import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuItemImage } from "@/components/images/MenuItemImage";
import { prisma } from "@/lib/db";
import {
  customerMenuCategoryDomId,
  loadCustomerVendorMenuSections,
  type CustomerVendorMenuItem,
} from "@/services/vendor-customer-menu.service";

function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function VendorMenuItemReadOnly({ item }: { item: CustomerVendorMenuItem }) {
  return (
    <div
      className={`flex gap-3 rounded-lg border border-stone-200 bg-white p-3 ${!item.isAvailable ? "opacity-80" : ""}`}
    >
      <MenuItemImage
        imageUrl={item.imageUrl}
        itemName={item.name}
        className="h-14 w-14 shrink-0 rounded-md object-cover"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-medium text-stone-900">{item.name}</h3>
          <span className="shrink-0 text-sm font-medium text-stone-800">{formatUsdFromCents(item.priceCents)}</span>
        </div>
        {item.description ? (
          <p className="mt-1 line-clamp-3 text-sm text-stone-600">{item.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-stone-500">
          {item.isAvailable ? (
            <span className="text-emerald-800">Available</span>
          ) : (
            <span className="text-amber-900">Unavailable</span>
          )}
        </p>
      </div>
    </div>
  );
}

export default async function VendorCurrentMenuPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { id: true, name: true },
  });
  if (!vendor) notFound();

  const { sections, source } = await loadCustomerVendorMenuSections(vendorId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">Current menu</h2>
          <p className="mt-0.5 text-sm text-stone-500">{vendor.name}</p>
          <p className="mt-1 text-sm text-stone-600">
            What customers see right now — published categories and items only (active operational rows).
          </p>
          <p className="mt-1 text-xs text-stone-500">
            Source:{" "}
            {source === "published_canonical"
              ? "Latest published menu snapshot"
              : "Active items (no published snapshot yet)"}
          </p>
        </div>
        <Link
          href={`/vendor/${vendorId}/menu-imports`}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm transition-colors hover:bg-stone-50"
        >
          View import history
        </Link>
      </div>

      {sections.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center text-sm text-stone-600">
          No active menu items yet. When your menu is imported and published, it will appear here. Use{" "}
          <Link href={`/vendor/${vendorId}/menu-imports`} className="font-medium text-sky-800 underline">
            import history
          </Link>{" "}
          to review jobs and publish.
        </div>
      ) : (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={customerMenuCategoryDomId(section.id)} className="scroll-mt-4">
              <h3 className="mb-3 text-base font-semibold text-stone-900">{section.name}</h3>
              <ul className="space-y-2">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <VendorMenuItemReadOnly item={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
