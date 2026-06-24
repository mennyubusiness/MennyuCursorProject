import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const srcRoot = join(process.cwd(), "src");

const REMOVED_OO_DASH_CLASSES = [
  "oo-dash-panel",
  "oo-dash-heading",
  "oo-dash-subheading",
  "oo-dash-btn-primary",
  "oo-dash-btn-secondary",
  "oo-dash-input",
  "oo-dash-table-wrap",
  "oo-dash-table",
] as const;

const WARM_BACKGROUND_PATHS = [
  "app/account",
  "app/orders",
  "components/auth",
  "components/legal",
  "components/marketing",
] as const;

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      walkSourceFiles(full, out);
    } else if (/\.(tsx?|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function readSrc(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function collectSourcesUnder(relativeDir: string, options?: { excludeTests?: boolean }): string {
  return walkSourceFiles(join(srcRoot, relativeDir))
    .filter((file) => !(options?.excludeTests && file.endsWith(".test.ts")))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

describe("dashboard CSS guardrails", () => {
  it("removes legacy oo-dash panel/heading/button/input/table classes from globals.css", () => {
    const globals = readSrc("app/globals.css");
    for (const className of REMOVED_OO_DASH_CLASSES) {
      expect(globals).not.toContain(`.${className}`);
    }
    expect(globals).toContain(".oo-dash-titlebar");
    expect(globals).toContain(".oo-dash-nav-link");
    expect(globals).toContain(".oo-shell");
  });

  it("does not use removed oo-dash utility classes in application source", () => {
    const sources = walkSourceFiles(srcRoot)
      .filter((file) => !file.endsWith("dashboard-guardrails.test.ts"))
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");

    for (const className of REMOVED_OO_DASH_CLASSES) {
      expect(sources).not.toMatch(new RegExp(`\\b${className}\\b`));
    }
  });
});

describe("warm background token guardrails", () => {
  it("does not use raw #EDE6DC in account/auth/legal/marketing surfaces", () => {
    for (const relativeDir of WARM_BACKGROUND_PATHS) {
      const combined = collectSourcesUnder(relativeDir, { excludeTests: true });
      expect(combined).not.toContain("#EDE6DC");
      expect(combined).toMatch(/bg-oo-cream/);
    }
  });

  it("does not import deleted account-hub-styles", () => {
    expect(existsSync(join(srcRoot, "app/account/account-hub-styles.ts"))).toBe(false);
    const accountSources = collectSourcesUnder("app/account");
    expect(accountSources).not.toContain("account-hub-styles");
  });
});

describe("shared dashboard primitive adoption", () => {
  it("exports dashboard primitives from the shared index", () => {
    const index = readSrc("components/dashboard/index.ts");
    expect(index).toContain("DashboardShell");
    expect(index).toContain("DashboardPageHeader");
    expect(index).toContain("DashboardCard");
    expect(index).toContain("DashboardStatusBadge");
    expect(index).toContain("DashboardEmptyState");
  });

  it("keeps tiered shells on primary dashboard surfaces", () => {
    expect(readSrc("app/pod/[podId]/dashboard/page.tsx")).toContain('tier="command"');
    expect(readSrc("app/pod/[podId]/settings/page.tsx")).toContain('tier="workspace"');
    expect(readSrc("app/vendor/[vendorId]/orders/page.tsx")).toContain('tier="command"');
    expect(readSrc("app/admin/(dashboard)/page.tsx")).toContain('tier="admin"');
    expect(readSrc("app/account/layout.tsx")).toContain('tier="hub"');
    expect(readSrc("app/orders/layout.tsx")).toContain('tier="hub"');
  });
});

describe("pod dashboard copy guardrails", () => {
  const podDashboardFiles = [
    "app/pod/[podId]/dashboard/page.tsx",
    "app/pod/[podId]/dashboard/PodDashboardMetrics.tsx",
    "app/pod/[podId]/dashboard/PodDashboardSidebar.tsx",
    "app/pod/[podId]/dashboard/PodDashboardActivityFeed.tsx",
    "app/pod/[podId]/settings/page.tsx",
    "app/pod/[podId]/settings/PodBrandProfileForm.tsx",
  ];

  it("does not reintroduce pickup instructions copy on pod dashboard/settings", () => {
    for (const file of podDashboardFiles) {
      expect(readSrc(file)).not.toMatch(/pickup instructions/i);
    }
  });

  it("does not expose earnings or payout language on pod-owner dashboard", () => {
    const combined = podDashboardFiles.map((file) => readSrc(file)).join("\n");
    expect(combined).not.toMatch(/\bearnings\b|\brevenue share\b|\bpayout\b/i);
  });
});

describe("account UI copy guardrails", () => {
  it("does not render raw role enum labels in account UI", () => {
    const accountUi = [
      "app/account/AccountToolsGrid.tsx",
      "app/account/AccountHubHeader.tsx",
      "app/account/(authenticated)/role/RolePicker.tsx",
    ]
      .map((file) => readSrc(file))
      .join("\n");

    expect(accountUi).not.toMatch(/>\s*vendor_owner\s*</);
    expect(accountUi).not.toMatch(/>\s*pod_owner\s*</);
    expect(accountUi).toContain("{opt.title}");
    expect(accountUi).toContain("formatAccountMembershipRole");
  });
});

describe("pod vendor status badge guardrails", () => {
  it("uses shared DashboardStatusBadge for pod roster/adoption vendor status", () => {
    expect(readSrc("app/pod/[podId]/dashboard/PodVendorRosterPanel.tsx")).toContain(
      "DashboardStatusBadge"
    );
    expect(readSrc("app/pod/[podId]/dashboard/PodVendorAdoptionBoard.tsx")).toContain(
      "DashboardStatusBadge"
    );
    expect(readSrc("lib/pod-vendor-display-badge.ts")).toContain("podVendorDisplayStatusTone");
  });
});
