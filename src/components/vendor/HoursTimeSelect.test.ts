import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "src");

describe("HoursTimeSelect", () => {
  const src = readFileSync(join(root, "components/vendor/HoursTimeSelect.tsx"), "utf8");

  it("renders the menu in a portal with fixed positioning", () => {
    expect(src).toMatch(/createPortal/);
    expect(src).toMatch(/document\.body/);
    expect(src).toMatch(/className="fixed/);
    expect(src).toMatch(/zIndex: MENU_Z_INDEX/);
  });

  it("uses combobox accessibility attributes", () => {
    expect(src).toMatch(/role="combobox"/);
    expect(src).toMatch(/aria-expanded=\{open\}/);
    expect(src).toMatch(/role="listbox"/);
    expect(src).toMatch(/role="option"/);
  });
});

describe("VendorCustomerOrderingHoursForm time controls", () => {
  const src = readFileSync(
    join(root, "app/vendor/[vendorId]/hours/VendorCustomerOrderingHoursForm.tsx"),
    "utf8"
  );

  it("uses overlay time selects instead of native time inputs", () => {
    expect(src).toMatch(/HoursTimeSelect/);
    expect(src).not.toMatch(/type="time"/);
  });
});
