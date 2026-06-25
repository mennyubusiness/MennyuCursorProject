import { describe, expect, it } from "vitest";
import { filterActionablePodSetupItems } from "./pod-dashboard-layout";
import { hashSecureInviteToken, buildPodVendorInviteUrl } from "@/lib/auth/secure-invite-token";

describe("secure invite token", () => {
  it("builds vendor invite URLs without podId", () => {
    const token = "test-token";
    expect(buildPodVendorInviteUrl("https://app.example.com", token)).toBe(
      "https://app.example.com/vendor/invite/test-token"
    );
  });

  it("hashes tokens consistently", () => {
    expect(hashSecureInviteToken("abc")).toHaveLength(64);
  });
});

describe("pod dashboard setup filters", () => {
  it("excludes vendor-dependent checklist rows from pod setup section", () => {
    const items = filterActionablePodSetupItems([
      {
        key: "pod_profile",
        label: "Pod profile",
        complete: false,
        owner: "pod_owner",
      },
      {
        key: "vendor_ready",
        label: "Vendor ready",
        complete: false,
        owner: "pod_owner",
      },
    ]);
    expect(items.map((item) => item.key)).toEqual(["pod_profile"]);
  });
});
