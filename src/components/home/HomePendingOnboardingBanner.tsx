import Link from "next/link";

import { getPendingAccountSetupRedirect } from "@/lib/auth/account-setup";
import { getPendingOnboardingLabel } from "@/lib/auth/account-paths";
import { PageShell } from "@/components/layout/page-shell";
import { buttonClassName } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export async function HomePendingOnboardingBanner({ userId }: { userId: string }) {
  const pendingHref = await getPendingAccountSetupRedirect(userId);
  if (!pendingHref) return null;

  const label = getPendingOnboardingLabel(pendingHref);
  const isVendorSetup = pendingHref.split("?")[0] === "/account/setup/vendor";

  return (
    <section className="border-b border-amber-200/80 bg-amber-50">
      <PageShell className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-amber-950">
            {isVendorSetup ? "Finish setting up your vendor account" : "Finish setting up your account"}
          </p>
          <p className="mt-1 text-sm text-amber-900/80">
            {isVendorSetup
              ? "You started vendor onboarding but haven’t completed your business profile yet."
              : "Pick up where you left off to unlock the right tools and navigation."}
          </p>
        </div>
        <Link
          href={pendingHref}
          className={cn(
            buttonClassName({ variant: "primary", size: "md" }),
            "w-full shrink-0 sm:w-auto"
          )}
        >
          {label}
        </Link>
      </PageShell>
    </section>
  );
}
