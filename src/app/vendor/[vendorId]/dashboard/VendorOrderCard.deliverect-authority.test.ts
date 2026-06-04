import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

describe("VendorOrderCard Deliverect authority UI", () => {
  const src = readFileSync(
    join(root, "src/app/vendor/[vendorId]/dashboard/VendorOrderCard.tsx"),
    "utf8"
  );

  it("shows POS-controlled notice for Deliverect-authoritative orders", () => {
    expect(src).toMatch(/VENDOR_DELIVERECT_CONTROLLED_NOTICE/);
    expect(src).toMatch(/deliverectAuthoritative/);
    expect(src).toMatch(/POS status:/);
  });

  it("suppresses next action when Deliverect-authoritative", () => {
    expect(src).toMatch(/deliverectAuthoritative\s*\?\s*null\s*:\s*getVendorOrderNextAction/);
  });

  it("blocks deny when Deliverect-authoritative via canVendorReject", () => {
    expect(src).toMatch(/canVendorRejectVendorOrder/);
  });
});
