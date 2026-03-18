import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { DeliverectMappingClient } from "./DeliverectMappingClient";

export default async function AdminVendorDeliverectMappingPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      name: true,
      slug: true,
      deliverectChannelLinkId: true,
    },
  });
  if (!vendor) notFound();

  const [menuItems, groups] = await Promise.all([
    prisma.menuItem.findMany({
      where: { vendorId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        priceCents: true,
        deliverectProductId: true,
      },
    }),
    prisma.modifierGroup.findMany({
      where: { vendorId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        name: true,
        options: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            priceCents: true,
            deliverectModifierId: true,
          },
        },
      },
    }),
  ]);

  const options = groups.flatMap((g) =>
    g.options.map((o) => ({
      ...o,
      groupName: g.name,
    }))
  );

  const missingProductId = menuItems.filter((m) => !m.deliverectProductId?.trim()).length;
  const missingModifierId = options.filter((o) => !o.deliverectModifierId?.trim()).length;

  return (
    <div>
      <p className="text-sm text-stone-500">
        <Link href="/admin/vendors" className="hover:underline">
          Vendors
        </Link>
        <span className="mx-1">/</span>
        <span className="text-stone-800">{vendor.name}</span>
      </p>
      <h1 className="mt-2 text-xl font-semibold text-stone-900">Deliverect ID mapping</h1>
      <p className="mt-1 text-sm text-stone-600">
        Attach Deliverect product and modifier IDs to existing Mennyu menu data for{" "}
        <strong>{vendor.name}</strong>. Clear a field and save to unset.
      </p>

      <div className="mt-6">
        <DeliverectMappingClient
          vendorId={vendor.id}
          deliverectChannelLinkId={vendor.deliverectChannelLinkId}
          menuItems={menuItems}
          options={options}
          stats={{
            missingProductId,
            missingModifierId,
            totalMenuItems: menuItems.length,
            totalModifierOptions: options.length,
          }}
        />
      </div>
    </div>
  );
}
