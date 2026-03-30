import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PodBrandProfileForm } from "./PodBrandProfileForm";
import { PodVendorPresentationForm } from "./PodVendorPresentationForm";

export default async function PodSettingsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      accentColor: true,
      vendors: {
        include: {
          vendor: { select: { id: true, name: true } },
        },
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!pod) notFound();

  const presentationRows = pod.vendors.map((pv) => ({
    vendorId: pv.vendorId,
    vendorName: pv.vendor.name,
    isFeatured: pv.isFeatured,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
        <p className="mt-1 text-sm text-stone-600">
          How this pod looks to customers and how vendors are ordered on the pod page.
        </p>
      </div>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Brand / profile</h2>
        <p className="mt-1 text-sm text-stone-600">
          Name, description, logo, and accent on the public pod page.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          URL slug: <span className="font-mono text-stone-700">{pod.slug}</span> (not editable here)
        </p>
        <div className="mt-4">
          <PodBrandProfileForm
            podId={pod.id}
            initialName={pod.name}
            initialDescription={pod.description}
            initialImageUrl={pod.imageUrl}
            initialAccentColor={pod.accentColor}
          />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Presentation</h2>
        <p className="mt-1 text-sm text-stone-600">Vendor order and featured flags — display only, not permissions.</p>
        <div className="mt-4">
          <PodVendorPresentationForm
            key={presentationRows.map((r) => `${r.vendorId}:${r.isFeatured ? 1 : 0}`).join(">")}
            podId={pod.id}
            initialRows={presentationRows}
          />
        </div>
      </section>
    </div>
  );
}
