import type { LoadedAccountPageContext } from "@/lib/account-page-context";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { DashboardCard, DashboardStatusBadge } from "@/components/dashboard";

type AccountHubHeaderProps = {
  ctx: LoadedAccountPageContext;
  primaryMode: HeaderNavMode;
};

function displayName(ctx: LoadedAccountPageContext): string {
  const name = ctx.emailAccount?.name?.trim();
  if (name) return name;
  const email = ctx.emailAccount?.email;
  if (email) return email.split("@")[0] ?? "Account";
  return "Account";
}

function hubSubtitle(primaryMode: HeaderNavMode): string {
  switch (primaryMode) {
    case "vendor":
      return "Manage your vendor account, kitchen access, and shortcuts.";
    case "pod":
      return "Manage your pod profile, vendor roster, and shortcuts.";
    case "admin":
      return "Platform admin account and operational shortcuts.";
    default:
      return "Manage your profile, order updates phone, and recent orders.";
  }
}

export function AccountHubHeader({ ctx, primaryMode }: AccountHubHeaderProps) {
  const name = displayName(ctx);
  const initial = name.charAt(0).toUpperCase();
  const roleBadges: Array<{ key: string; label: string; tone: "info" | "success" | "neutral" }> = [];

  if (ctx.staff?.isPlatformAdmin) {
    roleBadges.push({ key: "admin", label: "Platform admin", tone: "info" });
  }
  if (ctx.staff?.vendorMemberships.length) {
    roleBadges.push({ key: "vendor", label: "Vendor", tone: "success" });
  }
  if (ctx.staff?.podMemberships.length) {
    roleBadges.push({ key: "pod", label: "Pod owner", tone: "neutral" });
  }

  return (
    <DashboardCard className="shadow-[0_4px_20px_-8px_rgba(31,31,28,0.12)]">
      <div className="flex items-start gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-oo-cream text-xl font-bold text-oo-charcoal ring-2 ring-oo-light-stone"
          aria-hidden
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black tracking-tight text-oo-charcoal sm:text-3xl">{name}</h1>
          {ctx.emailAccount?.email && (
            <p className="mt-1 text-sm text-oo-stone-gray">{ctx.emailAccount.email}</p>
          )}
          {roleBadges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {roleBadges.map((badge) => (
                <DashboardStatusBadge key={badge.key} tone={badge.tone}>
                  {badge.label}
                </DashboardStatusBadge>
              ))}
            </div>
          )}
          <p className="mt-3 text-sm text-oo-stone-gray">{hubSubtitle(primaryMode)}</p>
        </div>
      </div>
    </DashboardCard>
  );
}
