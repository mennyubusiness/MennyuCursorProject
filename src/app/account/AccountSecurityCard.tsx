import Link from "next/link";

import { DashboardCard } from "@/components/dashboard";

type AccountSecurityCardProps = {
  email: string;
};

export function AccountSecurityCard({ email }: AccountSecurityCardProps) {
  const forgotPasswordHref = `/forgot-password?email=${encodeURIComponent(email)}`;

  return (
    <DashboardCard
      title="Security"
      description="Manage how you sign in to Open Order with email and password."
    >
      <div className="rounded-lg border border-oo-light-stone bg-oo-cream/50 p-4">
        <p className="text-sm font-medium text-oo-charcoal">Password</p>
        <p className="mt-1 text-sm text-oo-stone-gray">
          To change your password, we&apos;ll email you a secure reset link.
        </p>
        <Link
          href={forgotPasswordHref}
          className="mt-3 inline-flex rounded-lg border border-oo-charcoal bg-oo-warm-white px-4 py-2 text-sm font-semibold text-oo-charcoal hover:bg-white"
        >
          Change password
        </Link>
      </div>
    </DashboardCard>
  );
}
