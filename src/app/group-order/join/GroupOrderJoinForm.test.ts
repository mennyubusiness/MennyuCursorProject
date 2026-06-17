import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("GroupOrderJoinForm", () => {
  const src = readFileSync(
    join(process.cwd(), "src/app/group-order/join/GroupOrderJoinForm.tsx"),
    "utf8"
  );

  it("submits joinAttemptKey hidden field", () => {
    expect(src).toMatch(/name="joinAttemptKey"/);
  });

  it("disables submit while pending and shows Joining copy", () => {
    expect(src).toMatch(/useFormStatus/);
    expect(src).toMatch(/disabled=\{pending\}/);
    expect(src).toMatch(/Joining/);
  });

  it("guards against duplicate native form submit", () => {
    expect(src).toMatch(/submitGuardRef/);
    expect(src).toMatch(/e\.preventDefault\(\)/);
  });

  it("does not collect SMS consent", () => {
    expect(src).not.toMatch(/SmsConsentCheckbox/);
    expect(src).not.toMatch(/smsConsent/);
  });
});
