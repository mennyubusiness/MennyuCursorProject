import type { LoadedAccountPageContext } from "@/lib/account-page-context";
import { accountHubCardClass, accountHubMutedClass } from "./account-hub-styles";

type AccountHubHeaderProps = {
  ctx: LoadedAccountPageContext;
};

function displayName(ctx: LoadedAccountPageContext): string {
  const name = ctx.emailAccount?.name?.trim();
  if (name) return name;
  const email = ctx.emailAccount?.email;
  if (email) return email.split("@")[0] ?? "Account";
  return "Account";
}

function roleSummary(ctx: LoadedAccountPageContext): string | null {
  const parts: string[] = [];
  if (ctx.staff?.isPlatformAdmin) parts.push("Platform admin");
  if (ctx.staff?.vendorMemberships.length) parts.push("Vendor");
  if (ctx.staff?.podMemberships.length) parts.push("Pod");
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function AccountHubHeader({ ctx }: AccountHubHeaderProps) {
  const name = displayName(ctx);
  const initial = name.charAt(0).toUpperCase();
  const roles = roleSummary(ctx);

  return (
    <header className={accountHubCardClass}>
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
            <p className={`mt-1 ${accountHubMutedClass}`}>{ctx.emailAccount.email}</p>
          )}
          {roles && (
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-brand">{roles}</p>
          )}
          <p className={`mt-3 ${accountHubMutedClass}`}>
            Manage your profile, order updates phone, and shortcuts to your tools.
          </p>
        </div>
      </div>
    </header>
  );
}
