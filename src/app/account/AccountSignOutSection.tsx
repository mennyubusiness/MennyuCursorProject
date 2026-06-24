import { AccountSessionActions } from "./AccountSessionActions";
import { DashboardCard } from "@/components/dashboard";

export function AccountSignOutSection() {
  return (
    <DashboardCard
      title="Sign out"
      description="End your email sign-in session on this device. This does not delete your account."
    >
      <AccountSessionActions />
    </DashboardCard>
  );
}
