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
    expect(nav).toContain('href="/admin/pricing"');
    expect(nav).not.toMatch(/SETTINGS.*\/admin\/users/s);
    expect(nav).not.toMatch(/SETTINGS.*\/admin\/analytics/s);
  });

  it("orders dropdown links only to existing routes", () => {
    expect(nav).toContain('href="/admin/orders"');
    expect(nav).toContain('href="/admin/exceptions"');
    expect(nav).toContain('href="/admin/payout-transfers"');
  });

  it("operations dropdown includes sprint 3 triage routes", () => {
    expect(nav).toContain('href="/admin/incidents"');
    expect(nav).toContain('href="/admin/notifications"');
    expect(nav).toContain('href="/admin/webhooks"');
  });

  it("does not link health routes under operations dropdown", () => {
    const operationsBlock = nav.slice(nav.indexOf("const OPERATIONS"), nav.indexOf("const SETTINGS"));
    expect(operationsBlock).not.toContain("/admin/health");
  });
});

describe("AdminTopNav active styling", () => {
  it("uses shared pill active state without orange underline", () => {
    expect(styles).toContain(".oo-dash-titlebar-link.is-active,\n  .oo-dash-titlebar-link.is-group-active");
    expect(styles).toContain("box-shadow: none");
    expect(styles).not.toMatch(/is-active[\s\S]*box-shadow: inset 0 -2px 0 0 var\(--oo-brand\)/);
  });

  it("dropdown menus stay above page content", () => {
    expect(styles).toMatch(/oo-dash-titlebar-menu[\s\S]*z-50/);
  });
});
