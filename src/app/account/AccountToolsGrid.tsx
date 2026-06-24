import Link from "next/link";

import type { AccountStaffIdentity } from "@/lib/account-page-view-model";
import { formatAccountMembershipRole } from "@/lib/account-membership-labels";
import { ORDER_HISTORY_PATH } from "@/lib/auth/account-paths";
import type { HeaderNavMode } from "@/lib/auth/header-nav-types";
import { DashboardCard } from "@/components/dashboard";

type ToolCard = {
  title: string;
  description: string;
  href: string;
};

function buildToolCards(staff: AccountStaffIdentity | null, primaryMode: HeaderNavMode): ToolCard[] {
  const cards: ToolCard[] = [];

  if (primaryMode === "customer") {
    cards.push(
      {
        title: "Order history",
        description: "View your orders, details, and reorder.",
        href: ORDER_HISTORY_PATH,
      },
      {
        title: "Explore pods",
        description: "Find a pod and start a new order.",
        href: "/explore",
      }
    );
  }

  if (primaryMode === "vendor" && staff) {
    for (const v of staff.vendorMemberships) {
      const roleLabel = formatAccountMembershipRole(v.role);
      cards.push(
        {
          title: v.vendorName,
          description: `Manage your vendor account · ${roleLabel}`,
          href: v.href,
        },
        {
          title: `${v.vendorName} · Kitchen`,
          description: "Kitchen mode for live order prep.",
          href: `${v.href}/kitchen`,
        },
        {
          title: `${v.vendorName} · Orders`,
          description: "Incoming and active vendor orders.",
          href: `${v.href}/orders`,
        },
        {
          title: `${v.vendorName} · Settings`,
          description: "Set up payments, menu, and notifications.",
          href: `${v.href}/settings`,
        }
      );
    }
  }

  if (primaryMode === "pod" && staff) {
    for (const p of staff.podMemberships) {
      const roleLabel = formatAccountMembershipRole(p.role);
      cards.push(
        {
          title: p.podName,
          description: `Manage your pod · ${roleLabel}`,
          href: p.href,
        },
        {
          title: `${p.podName} · Settings`,
          description: "Pod profile, ordering QR, and availability.",
          href: p.href.replace(/\/dashboard$/, "") + "/settings",
        },
        {
          title: `${p.podName} · Vendors`,
          description: "Manage vendor roster and participation.",
          href: p.href,
        }
      );
    }
  }

  if (primaryMode === "admin" && staff?.showAdminLink) {
    cards.push({
      title: "Platform admin",
      description: "Operations, orders, and support tools.",
      href: "/admin",
    });
  }

  if (staff && primaryMode !== "customer") {
    for (const v of staff.vendorMemberships) {
      if (primaryMode === "vendor") continue;
      cards.push({
        title: v.vendorName,
        description: `Manage your vendor account · ${formatAccountMembershipRole(v.role)}`,
        href: v.href,
      });
    }
    for (const p of staff.podMemberships) {
      if (primaryMode === "pod") continue;
      cards.push({
        title: p.podName,
        description: `Manage your pod · ${formatAccountMembershipRole(p.role)}`,
        href: p.href,
      });
    }
    if (primaryMode !== "admin" && staff.showAdminLink) {
      cards.push({
        title: "Platform admin",
        description: "Operations, orders, and support tools.",
        href: "/admin",
      });
    }
  }

  return cards;
}

type AccountToolsGridProps = {
  staff: AccountStaffIdentity | null;
  primaryMode: HeaderNavMode;
};

export function AccountToolsGrid({ staff, primaryMode }: AccountToolsGridProps) {
  const tools = buildToolCards(staff, primaryMode);

  return (
    <DashboardCard title="Your tools" description="Shortcuts based on your account and roles.">
      <ul className="grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={`${tool.href}-${tool.title}`}>
            <Link
              href={tool.href}
              className="flex h-full flex-col rounded-lg border border-oo-light-stone bg-oo-cream/40 p-4 transition hover:border-brand/40 hover:bg-oo-cream/80"
            >
              <span className="font-semibold text-oo-charcoal">{tool.title}</span>
              <span className="mt-1 text-sm text-oo-stone-gray">{tool.description}</span>
              <span className="mt-3 text-sm font-semibold text-brand">Open →</span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
