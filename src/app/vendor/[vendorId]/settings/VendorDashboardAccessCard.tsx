import { VendorAccountSection } from "./VendorAccountSection";
import { VendorAdminAccessToolsCard } from "./VendorAdminAccessToolsCard";

type Props = {
  vendorId: string;
  hasDashboardSecret: boolean;
  userEmail: string | null;
  isPlatformAdmin: boolean;
};

/**
 * Vendor settings: minimal account copy for restaurant users; full technical tooling only for platform admins.
 * Backend tokens/routes unchanged — UI routing only.
 */
export function VendorDashboardAccessCard({
  vendorId,
  hasDashboardSecret,
  userEmail,
  isPlatformAdmin,
}: Props) {
  if (isPlatformAdmin) {
    return (
      <div className="space-y-6">
        <VendorAccountSection email={userEmail} variant="admin" />
        <VendorAdminAccessToolsCard vendorId={vendorId} hasDashboardSecret={hasDashboardSecret} />
      </div>
    );
  }

  return <VendorAccountSection email={userEmail} variant="vendor" />;
}
