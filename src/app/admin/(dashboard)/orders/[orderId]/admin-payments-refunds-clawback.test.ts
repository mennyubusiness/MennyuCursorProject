import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = dirname(fileURLToPath(import.meta.url));
const panelSrc = readFileSync(join(dir, "AdminPaymentsRefundsPanel.tsx"), "utf8");

describe("AdminPaymentsRefundsPanel clawback UI", () => {
  it("hides reversal rows when clawback is not needed", () => {
    expect(panelSrc).toMatch(
      /v\.clawback\.clawbackStatus !== "not_needed" && v\.reversals\.length > 0/
    );
  });

  it("does not hardcode Vendor clawback not needed in vendor table cells", () => {
    expect(panelSrc).not.toMatch(/Vendor clawback not needed/);
  });
});
