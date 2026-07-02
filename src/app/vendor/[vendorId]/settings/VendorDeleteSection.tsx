import { EntityDeleteDangerZone } from "@/components/entity-deletion/EntityDeleteDangerZone";

type VendorDeleteSectionProps = {
  vendorId: string;
  vendorName: string;
  deletedAt: Date | null;
};

export function VendorDeleteSection({ vendorId, vendorName, deletedAt }: VendorDeleteSectionProps) {
  if (deletedAt) {
    return (
      <div className="rounded-xl border border-oo-light-stone bg-oo-cream px-4 py-3 text-sm text-oo-stone-gray">
        This vendor was deleted on {deletedAt.toLocaleDateString()}. Historical orders and payment
        records are retained for support and accounting.
      </div>
    );
  }

  return (
    <EntityDeleteDangerZone
      title="Delete vendor"
      description="This vendor will be removed from public ordering. Historical orders and payment records are preserved. Active orders must be completed or cancelled first."
      entityLabel={vendorName}
      deleteUrl={`/api/vendor/${vendorId}/delete`}
      redirectTo="/account"
    />
  );
}
