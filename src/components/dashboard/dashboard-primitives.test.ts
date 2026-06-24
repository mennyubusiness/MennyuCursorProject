import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src/components/dashboard");

function readComponent(name: string): string {
  return readFileSync(join(root, name), "utf8");
}

describe("dashboard primitives", () => {
  it("DashboardShell supports command tier and sidebar layout", () => {
    const shell = readComponent("DashboardShell.tsx");
    const styles = readComponent("dashboard-styles.ts");
    expect(shell).toContain("DashboardShell");
    expect(shell).toContain("withSidebar");
    expect(shell).toContain("DashboardShellMain");
    expect(styles).toContain('command: "mx-auto w-full max-w-7xl px-4"');
    expect(styles).toContain('hub: "mx-auto w-full max-w-3xl px-4"');
    expect(styles).toContain('admin: "oo-shell w-full"');
  });

  it("DashboardPageHeader renders semantic heading and action layout", () => {
    const header = readComponent("DashboardPageHeader.tsx");
    expect(header).toContain('headingLevel === 1 ? "h1" : "h2"');
    expect(header).toContain("sm:flex-row sm:items-start sm:justify-between");
    expect(header).toContain("eyebrow");
    expect(header).toContain("actions");
  });

  it("DashboardSection supports anchor ids and scroll offset", () => {
    const section = readComponent("DashboardSection.tsx");
    const styles = readComponent("dashboard-styles.ts");
    expect(section).toContain("DASHBOARD_SECTION_SCROLL_CLASS");
    expect(styles).toContain("scroll-mt-32");
    expect(section).toContain('id={id}');
    expect(section).toContain("showHeader");
  });

  it("DashboardCard supports variant styling", () => {
    const card = readComponent("DashboardCard.tsx");
    const styles = readComponent("dashboard-styles.ts");
    expect(card).toContain("DASHBOARD_CARD_VARIANT_CLASS");
    expect(styles).toContain("muted");
    expect(styles).toContain("warning");
    expect(card).toContain("rounded-xl border");
  });

  it("DashboardMetricCard renders label, value, and helper", () => {
    const metric = readComponent("DashboardMetricCard.tsx");
    expect(metric).toContain("label");
    expect(metric).toContain("value");
    expect(metric).toContain("helper");
    expect(metric).toContain("tabular-nums");
    expect(metric).toContain("empty");
  });

  it("DashboardStatusBadge maps tone variants to shared classes", () => {
    const badge = readComponent("DashboardStatusBadge.tsx");
    const styles = readComponent("dashboard-styles.ts");
    expect(badge).toContain("DASHBOARD_STATUS_TONE_CLASS");
    expect(styles).toMatch(/success: "bg-emerald-50/);
    expect(styles).toMatch(/warning: "bg-amber-50/);
    expect(styles).toMatch(/danger: "bg-red-50/);
    expect(styles).toMatch(/neutral: "bg-zinc-100/);
    expect(styles).toMatch(/info: "bg-sky-50/);
    expect(styles).toMatch(/muted: "bg-oo-cream/);
  });

  it("DashboardEmptyState renders title, description, and action slots", () => {
    const empty = readComponent("DashboardEmptyState.tsx");
    expect(empty).toContain('role="status"');
    expect(empty).toContain("title");
    expect(empty).toContain("description");
    expect(empty).toContain("action");
    expect(empty).toContain("compact");
  });

  it("exports primitives from index", () => {
    const index = readFileSync(join(root, "index.ts"), "utf8");
    expect(index).toContain("DashboardShell");
    expect(index).toContain("DashboardPageHeader");
    expect(index).toContain("DashboardSection");
    expect(index).toContain("DashboardCard");
    expect(index).toContain("DashboardMetricGrid");
    expect(index).toContain("DashboardMetricCard");
    expect(index).toContain("DashboardStatusBadge");
    expect(index).toContain("DashboardEmptyState");
  });
});
