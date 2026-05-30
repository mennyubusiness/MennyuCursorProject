import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const orderPageSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "OrderPageContent.tsx"),
  "utf8"
);

describe("OrderPageContent customer cancel UI removed", () => {
  it("does not import or render direct cancel controls", () => {
    expect(orderPageSrc).not.toMatch(/OrderCancelButton/);
    expect(orderPageSrc).not.toMatch(/VendorOrderCancelButton/);
    expect(orderPageSrc).not.toMatch(/canCustomerCancel/);
    expect(orderPageSrc).not.toMatch(/can no longer be cancelled/i);
    expect(orderPageSrc).not.toMatch(/Cancel order/);
  });

  it("still renders the help section for support requests", () => {
    expect(orderPageSrc).toMatch(/OrderHelpSection/);
  });

  it("does not call legacy customer cancel API routes", () => {
    expect(orderPageSrc).not.toMatch(/\/api\/order\/.*\/cancel/);
    expect(orderPageSrc).not.toMatch(/vendor-orders\/.*\/cancel/);
  });
});
