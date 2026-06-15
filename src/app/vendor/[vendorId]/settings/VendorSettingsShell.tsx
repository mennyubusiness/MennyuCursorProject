"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  VENDOR_SETTINGS_SECTIONS,
  type VendorSettingsSectionBadges,
  type VendorSettingsSectionId,
  vendorSettingsSectionHeader,
  vendorSettingsSectionHref,
} from "@/lib/vendor-settings-sections";

type SetupSummary = {
  profile: boolean;
  stripe: boolean;
  pos: boolean;
  menu: boolean;
};

function badgeTone(label: string | undefined): string {
  if (!label) return "bg-oo-cream text-oo-stone-gray";
  if (label === "Complete" || label === "Connected" || label === "Open" || label === "Linked") {
    return "bg-emerald-50 text-emerald-900";
  }
  if (label === "Paused" || label === "Needs menu" || label === "Invite pending" || label === "Needs setup") {
    return "bg-amber-50 text-amber-950";
  }
  return "bg-oo-cream text-oo-stone-gray";
}

function SetupSummaryRail({ summary }: { summary: SetupSummary }) {
  const rows: Array<{ label: string; ok: boolean }> = [
    { label: "Profile", ok: summary.profile },
    { label: "Payouts", ok: summary.stripe },
    { label: "POS", ok: summary.pos },
    { label: "Menu", ok: summary.menu },
  ];

  return (
    <aside className="hidden shrink-0 xl:block xl:w-72">
      <div className="sticky top-4 rounded-xl border border-oo-light-stone bg-oo-warm-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-oo-charcoal">Setup summary</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="text-oo-stone-gray">{row.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  row.ok ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"
                }`}
              >
                {row.ok ? "Complete" : "Needs setup"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function SectionNavLink({
  vendorId,
  section,
  label,
  subtitle,
  active,
  badge,
}: {
  vendorId: string;
  section: VendorSettingsSectionId;
  label: string;
  subtitle: string;
  active: boolean;
  badge?: string;
}) {
  return (
    <Link
      href={vendorSettingsSectionHref(vendorId, section)}
      className={`block rounded-lg px-3 py-2.5 transition ${
        active
          ? "bg-oo-warm-white shadow-sm ring-1 ring-oo-light-stone"
          : "hover:bg-oo-warm-white/70"
      }`}
      aria-current={active ? "page" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-oo-charcoal">{label}</span>
        {badge ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium leading-tight ${badgeTone(badge)}`}>
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-oo-stone-gray">{subtitle}</p>
    </Link>
  );
}

export function VendorSettingsShell({
  vendorId,
  vendorName,
  activeSection,
  badges,
  setupSummary,
  children,
}: {
  vendorId: string;
  vendorName: string;
  activeSection: VendorSettingsSectionId;
  badges: VendorSettingsSectionBadges;
  setupSummary: SetupSummary;
  children: ReactNode;
}) {
  const { title, description } = vendorSettingsSectionHeader(activeSection);

  return (
    <div className="min-w-0">
      <header className="border-b border-oo-light-stone pb-6">
        <h2 className="text-2xl font-semibold text-oo-charcoal">Settings</h2>
        <p className="mt-1 text-sm font-medium text-oo-charcoal">{vendorName}</p>
        <p className="mt-2 max-w-3xl text-sm text-oo-stone-gray">
          Manage your profile, payouts, POS connection, ordering, pod membership, and account settings.
        </p>
      </header>

      <div className="mt-4 lg:hidden">
        <label htmlFor="vendor-settings-section-mobile" className="sr-only">
          Settings section
        </label>
        <select
          id="vendor-settings-section-mobile"
          className="w-full rounded-lg border border-oo-light-stone bg-oo-warm-white px-3 py-2.5 text-sm text-oo-charcoal"
          value={activeSection}
          onChange={(e) => {
            window.location.href = vendorSettingsSectionHref(
              vendorId,
              e.target.value as VendorSettingsSectionId
            );
          }}
        >
          {VENDOR_SETTINGS_SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
              {badges[s.id] ? ` — ${badges[s.id]}` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 flex flex-col gap-8 xl:flex-row xl:items-start">
        <nav
          className="hidden shrink-0 lg:block lg:w-60 xl:w-64"
          aria-label="Settings sections"
        >
          <div className="sticky top-4 space-y-1">
            {VENDOR_SETTINGS_SECTIONS.map((s) => (
              <SectionNavLink
                key={s.id}
                vendorId={vendorId}
                section={s.id}
                label={s.label}
                subtitle={s.subtitle}
                active={activeSection === s.id}
                badge={badges[s.id]}
              />
            ))}
          </div>
        </nav>

        <div className="min-w-0 flex-1 xl:max-w-3xl">
          {activeSection !== "overview" ? (
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-oo-charcoal">{title}</h3>
              {description ? <p className="mt-1 text-sm text-oo-stone-gray">{description}</p> : null}
            </div>
          ) : null}
          {children}
        </div>

        {activeSection === "overview" ? <SetupSummaryRail summary={setupSummary} /> : null}
      </div>
    </div>
  );
}
