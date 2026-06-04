import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const attentionSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "admin-attention.ts"),
  "utf8"
);
const workbenchSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../app/admin/(dashboard)/exceptions/IssuesWorkbench.tsx"),
  "utf8"
);

describe("customer support issue dedupe in admin attention", () => {
  it("does not add generic open_issue row when customer issue already has attention item", () => {
    expect(attentionSrc).toMatch(/customerIssueOrderIds/);
    expect(attentionSrc).toMatch(/!customerIssueOrderIds\.has\(id\)/);
  });

  it("shows customer message on customer_reported_issue rows", () => {
    expect(workbenchSrc).toMatch(/customer_reported_issue/);
    expect(workbenchSrc).toMatch(/issueCustomerMessage/);
  });
});
