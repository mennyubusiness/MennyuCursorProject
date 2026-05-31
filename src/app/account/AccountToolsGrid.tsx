import Link from "next/link";

import type { AccountStaffIdentity } from "@/lib/account-page-view-model";
import { ORDER_HISTORY_PATH } from "@/lib/auth/account-paths";
import {
  accountHubCardClass,
  accountHubMutedClass,
  accountHubSectionTitleClass,
} from "./account-hub-styles";

type ToolCard = {
  title: string;
  description: string;
  href: string;
};

function buildToolCards(staff: AccountStaffIdentity | null): ToolCard[] {
  const cards: ToolCard[] = [
    {
      title: "Order history",
      description: "Past orders, details, and reorder.",
      href: ORDER_HISTORY_PATH,
    },
  ];

  if (staff) {
    for (const v of staff.vendorMemberships) {
      cards.push({
        title: v.vendorName,
        description: `Vendor dashboard · ${v.role.replace(/_/g, " ")}`,
        href: v.href,
      });
    }
    for (const p of staff.podMemberships) {
      cards.push({
        title: p.podName,
        description: `Pod dashboard · ${p.role.replace(/_/g, " ")}`,
        href: p.href,
      });
    }
    if (staff.showAdminLink) {
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
};

export function AccountToolsGrid({ staff }: AccountToolsGridProps) {
  const tools = buildToolCards(staff);

  return (
    <section className={accountHubCardClass}>
      <h2 className={accountHubSectionTitleClass}>Your tools</h2>
      <p className={`mt-1 ${accountHubMutedClass}`}>
        Shortcuts based on your account and roles.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <li key={tool.href}>
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
    </section>
  );
}
