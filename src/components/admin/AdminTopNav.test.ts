import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const nav = readFileSync(join(process.cwd(), "src/components/admin/AdminTopNav.tsx"), "utf8");
const styles = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

describe("AdminTopNav structure", () => {
  it("exposes core top-level nav items", () => {
    expect(nav).toContain('label="Dashboard"');
    expect(nav).toContain('label="Orders"');
    expect(nav).toContain('label="Marketplace"');
    expect(nav).toContain('label="Operations"');
    expect(nav).toContain('label="Users"');
    expect(nav).toContain('label="Health"');
    expect(nav).toContain('label="Analytics"');
    expect(nav).toContain('label="Settings"');
  });

  it("links Users and Analytics at top level", () => {
    expect(nav).toContain('href="/admin/users"');
    expect(nav).toContain('href="/admin/analytics"');
    expect(nav).toContain('href="/admin/health"');
  });

  it("keeps Settings limited to configuration routes", () => {
    const settingsBlock = nav.slice(nav.indexOf("const SETTINGS:"), nav.indexOf("/** Route prefixes"));
    expect(settingsBlock).toMatch(/href: "\/admin\/pricing"/);
    expect(settingsBlock).not.toMatch(/\/admin\/users/);
    expect(settingsBlock).not.toMatch(/\/admin\/analytics/);
  });

  it("orders dropdown links only to existing routes", () => {
    expect(nav).toMatch(/href: "\/admin\/orders"/);
    expect(nav).toMatch(/href: "\/admin\/exceptions"/);
    expect(nav).toMatch(/href: "\/admin\/payout-transfers"/);
  });

  it("operations dropdown includes sprint 3 triage routes", () => {
    expect(nav).toMatch(/href: "\/admin\/incidents"/);
    expect(nav).toMatch(/href: "\/admin\/notifications"/);
    expect(nav).toMatch(/href: "\/admin\/webhooks"/);
  });

  it("does not link health routes under operations dropdown", () => {
    const operationsBlock = nav.slice(nav.indexOf("const OPERATIONS"), nav.indexOf("const SETTINGS"));
    expect(operationsBlock).not.toContain("/admin/health");
  });
});

describe("AdminTopNav active styling", () => {
  it("uses shared pill active state without orange underline", () => {
    expect(styles).toMatch(/\.oo-dash-titlebar-link\.is-active,\s+\.oo-dash-titlebar-link\.is-group-active/);
    expect(styles).toContain("box-shadow: none");
    expect(styles).not.toMatch(/box-shadow: inset 0 -2px 0 0 var\(--oo-brand\)/);
  });

  it("dropdown menus stay above page content", () => {
    expect(styles).toMatch(/oo-dash-titlebar-menu[\s\S]*z-\[60\]/);
    expect(styles).toMatch(/oo-dash-titlebar[\s\S]*overflow-visible/);
  });

  it("does not clip dropdowns with horizontal scroll overflow on nav", () => {
    expect(nav).not.toContain("overflow-x-auto");
    expect(nav).toContain("overflow-visible");
  });

  it("opens dropdowns on click without hover-only handlers", () => {
    expect(nav).toContain("onClick={toggle}");
    expect(nav).not.toContain("onMouseEnter");
    expect(nav).not.toContain("onMouseLeave");
  });
});
