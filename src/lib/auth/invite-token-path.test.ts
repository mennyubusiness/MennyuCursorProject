import { describe, expect, it } from "vitest";
import {
  appendNextQueryParam,
  buildVendorInvitePath,
  extractInviteTokenFromPath,
  isVendorInvitePath,
} from "@/lib/auth/invite-token-path";

describe("invite-token-path", () => {
  it("detects vendor invite paths", () => {
    expect(isVendorInvitePath("/vendor/invite/abc123")).toBe(true);
    expect(isVendorInvitePath("/vendor/dashboard")).toBe(false);
  });

  it("extracts token from invite path", () => {
    expect(extractInviteTokenFromPath("/vendor/invite/my-token")).toBe("my-token");
    expect(extractInviteTokenFromPath("/vendor/invite/my%2Btoken")).toBe("my+token");
  });

  it("builds invite path from token", () => {
    expect(buildVendorInvitePath("abc")).toBe("/vendor/invite/abc");
  });

  it("appends next query param", () => {
    expect(appendNextQueryParam("/account/setup/vendor", "/vendor/invite/tok")).toBe(
      "/account/setup/vendor?next=%2Fvendor%2Finvite%2Ftok"
    );
  });
});
