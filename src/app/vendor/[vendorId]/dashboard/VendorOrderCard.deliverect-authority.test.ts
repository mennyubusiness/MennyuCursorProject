import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("VendorOrderCard kitchen action lock UI", () => {
  const src = readFileSync(
    join(root, "src/app/vendor/[vendorId]/dashboard/VendorOrderCard.tsx"),
    "utf8"
  );

  it("uses kitchen action policy for provider-managed orders", () => {
    expect(src).toMatch(/getKitchenActionPolicy/);
    expect(src).toMatch(/kitchenPolicy\.showProviderManagedState/);
    expect(src).toMatch(/kitchenPolicy\.managedOrderBadge/);
  });

  it("suppresses next action when kitchen actions are locked", () => {
    expect(src).toMatch(/actionsLocked\s*\?\s*null\s*:\s*getVendorOrderNextAction/);
  });

  it("blocks deny when locked via canVendorReject", () => {
    expect(src).toMatch(/canVendorRejectVendorOrder/);
  });
});
