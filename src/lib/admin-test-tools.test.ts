import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("admin test tools gating", () => {
  it("is disabled in production unless ENABLE_ADMIN_TEST_TOOLS=true", () => {
    const src = readFileSync(join(root, "src/lib/admin-test-tools.ts"), "utf8");
    expect(src).toMatch(/NODE_ENV !== "production"/);
    expect(src).toMatch(/ENABLE_ADMIN_TEST_TOOLS === "true"/);
  });

  it("simulate routing failure route requires platform admin", () => {
    const src = readFileSync(
      join(root, "src/app/api/admin/vendor-orders/[vendorOrderId]/simulate-routing-failure/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/assertAdminTestToolsApiAccess/);
    expect(src).not.toMatch(/submitVendorOrder/);
    expect(src).not.toMatch(/submitOrder/);
  });

  it("admin order detail hides QA section unless canShowAdminTestToolsUi", () => {
    const pageSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/orders/[orderId]/page.tsx"),
      "utf8"
    );
    const buttonSrc = readFileSync(
      join(root, "src/app/admin/(dashboard)/orders/[orderId]/AdminSimulateRoutingFailureButton.tsx"),
      "utf8"
    );
    expect(pageSrc).toMatch(/canShowAdminTestToolsUi/);
    expect(pageSrc).toMatch(/AdminSimulateRoutingFailureButton/);
    expect(buttonSrc).toMatch(/Simulate routing failure/);
  });
});
