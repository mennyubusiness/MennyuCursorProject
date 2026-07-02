import { EntityDeleteDangerZone } from "@/components/entity-deletion/EntityDeleteDangerZone";

type PodDeleteSectionProps = {
  podId: string;
  podName: string;
  deletedAt: Date | null;
  activeVendorCount: number;
};

export function PodDeleteSection({
  podId,
  podName,
  deletedAt,
  activeVendorCount,
}: PodDeleteSectionProps) {
  if (deletedAt) {
    return (
      <div className="rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-3 text-sm text-oo-stone-gray">
        This pod was deleted on {deletedAt.toLocaleDateString()}. Historical orders and payment
        records are retained for support and accounting.
      </div>
    );
  }

  return (
    <EntityDeleteDangerZone
      title="Delete pod"
      description="This pod will be removed from public ordering and explore. QR and order links will stop accepting new orders. Historical records are preserved."
      entityLabel={podName}
      deleteUrl={`/api/pod/${podId}/delete`}
      redirectTo="/account"
      requireActiveVendorAck={activeVendorCount > 0}
      activeVendorCount={activeVendorCount}
    />
  );
}
