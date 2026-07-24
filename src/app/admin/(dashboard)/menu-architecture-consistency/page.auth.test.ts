import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "page.tsx"),
  "utf8"
);

describe("menu-architecture-consistency admin page auth", () => {
  it("uses the canonical admin dashboard layout gate (not a custom isPlatformAdmin import)", () => {
    expect(pageSrc).toContain("isAdminDashboardLayoutAuthorized");
    expect(pageSrc).toContain('from "@/lib/admin-auth"');
    expect(pageSrc).not.toContain("isPlatformAdmin");
    expect(pageSrc).not.toContain("@/lib/permissions");
  });

  it("redirects unauthorized production callers to access-denied before loading diagnostics", () => {
    expect(pageSrc).toContain('redirect("/admin/access-denied")');
    const fnStart = pageSrc.indexOf("export default async function AdminMenuArchitectureConsistencyPage");
    const body = pageSrc.slice(fnStart);
    const authIdx = body.indexOf("isAdminDashboardLayoutAuthorized");
    const redirectIdx = body.indexOf('redirect("/admin/access-denied")');
    const reportIdx = body.indexOf("buildMenuArchitectureConsistencyReport");
    expect(authIdx).toBeGreaterThan(-1);
    expect(redirectIdx).toBeGreaterThan(authIdx);
    expect(reportIdx).toBeGreaterThan(redirectIdx);
  });
});
