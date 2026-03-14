import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function PodSettingsPage({
  params,
}: {
  params: Promise<{ podId: string }>;
}) {
  const { podId } = await params;

  const pod = await prisma.pod.findUnique({
    where: { id: podId },
    select: { id: true, name: true },
  });
  if (!pod) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
      <p className="text-sm text-stone-600">
        Pod configuration and preferences. More options will appear here as they become available.
      </p>

      <section className="rounded-lg border border-stone-200 bg-stone-50/80 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Pod info
        </h2>
        <p className="mt-2 font-medium text-stone-900">{pod.name}</p>
        <p className="mt-1 text-xs text-stone-500">Pod settings are read-only for now.</p>
      </section>
    </div>
  );
}
