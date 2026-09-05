import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const src = join(root, "src");
const read = (path: string) => readFileSync(join(src, path), "utf8");

describe("VendorClaimInvite schema and migration", () => {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(root, "prisma/migrations/20260905033000_vendor_claim_invite/migration.sql"),
    "utf8"
  );

  it("stores only a unique hash with expiry, revoke, and single-use fields", () => {
    expect(schema).toMatch(/model VendorClaimInvite[\s\S]*tokenHash\s+String\s+@unique/);
    expect(schema).toMatch(/model VendorClaimInvite[\s\S]*vendorId\s+String\s+@unique/);
    expect(schema).toMatch(/model VendorClaimInvite[\s\S]*expiresAt\s+DateTime/);
    expect(schema).toMatch(/model VendorClaimInvite[\s\S]*claimedAt\s+DateTime\?/);
    expect(schema).toMatch(/model VendorClaimInvite[\s\S]*revokedAt\s+DateTime\?/);
    expect(schema).not.toMatch(/model VendorClaimInvite[\s\S]{0,700}\btoken\s+String/);
  });

  it("is additive and does not mutate existing business data", () => {
    expect(migration).toContain('CREATE TABLE "VendorClaimInvite"');
    expect(migration).not.toMatch(/UPDATE\s+"(Vendor|MenuItem|MenuVersion|PodVendor)"/i);
    expect(migration).not.toMatch(/orderingEnabled|menuSource|orderRoutingMode|stripe|square|deliverect/i);
  });
});

describe("authorization and ownership separation", () => {
  it("keeps ownership in VendorMembership rather than Vendor.ownerId", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    const vendorModel = schema.slice(schema.indexOf("model Vendor {"), schema.indexOf("model VendorMenuCategory"));
    expect(vendorModel).not.toMatch(/\bownerId\b/);
    expect(vendorModel).toContain("vendorMemberships");
  });

  it("keeps existing self-service creation creating an owner", () => {
    const setup = read("actions/account-setup.actions.ts");
    expect(setup).toMatch(/prisma\.vendor\.create[\s\S]{0,900}?vendorMemberships/);
    expect(setup).toMatch(/role:\s*VendorMembershipRole\.owner/);
  });

  it("keeps menu builder authorization membership-based", () => {
    const actions = read("actions/vendor-menu-builder.actions.ts");
    const auth = read("lib/server/vendor-settings-authorization.ts");
    const permissions = read("lib/permissions.ts");
    expect(actions).toContain("authorizeVendorSettingsWrite");
    expect(auth).toContain("canViewVendor");
    expect(permissions).toMatch(/canViewVendor[\s\S]{0,700}?vendorMembership/);
  });

  it("keeps all concierge and invite controls behind platform admin actions", () => {
    expect(read("actions/admin-pod.actions.ts")).toMatch(
      /adminCreateUnclaimedVendorAction[\s\S]{0,500}?withAdmin/
    );
    const vendorActions = read("actions/admin-vendor.actions.ts");
    for (const action of [
      "adminSendVendorClaimInviteAction",
      "adminResendVendorClaimInviteAction",
      "adminRevokeVendorClaimInviteAction",
    ]) {
      expect(vendorActions).toMatch(new RegExp(`${action}[\\s\\S]{0,500}?withAdmin`));
    }
  });
});

describe("public and ordering behavior", () => {
  it("does not add claim state to public readiness", () => {
    for (const file of [
      "lib/vendor-readiness-states.ts",
      "lib/vendor-readiness-validation.server.ts",
      "lib/vendor-ordering-mode.ts",
      "lib/vendor-orderability-in-pod.ts",
      "lib/pod-customer-page-data.ts",
      "lib/vendor-menu-customer-page-render.tsx",
    ]) {
      expect(read(file)).not.toMatch(/claimState|claimInvite|VendorClaimInvite/);
    }
  });

  it("does not expose claim or unclaimed copy on customer components", () => {
    for (const file of [
      "components/pod/PodVendorCard.tsx",
      "components/vendor-menu/VendorMenuHero.tsx",
      "components/vendor-menu/VendorMenuItemCard.tsx",
    ]) {
      expect(read(file)).not.toMatch(/\bUnclaimed\b|Claim this vendor|Owner not registered/);
    }
  });
});

describe("claim authentication and first login", () => {
  it("allows claim paths through safe post-login routing", () => {
    const routing = read("lib/auth/post-login-destination.ts");
    expect(routing).toContain("isVendorClaimPath");
    expect(routing).toMatch(/pendingSetup[\s\S]{0,200}?isVendorClaimPath/);
  });

  it("returns new registrations directly to the claim page", () => {
    const register = read("app/register/RegisterForm.tsx");
    expect(register).toContain("verificationReturnPath");
    expect(register).toMatch(/isVendorClaimPath\(returnPathSafe\)[\s\S]{0,250}?router\.push\(returnPathSafe\)/);
  });

  it("preserves the claim path through email verification", () => {
    const service = read("services/email-verification.service.ts");
    const page = read("app/verify-email/page.tsx");
    expect(service).toContain("returnPath");
    expect(service).toContain("isVendorClaimPath");
    expect(page).toContain("Continue to claim vendor");
  });

  it("shows only one concise claimed success message", () => {
    const dashboard = read("app/vendor/[vendorId]/dashboard/page.tsx");
    expect(dashboard).toContain('query.claimed === "1"');
    expect(dashboard).toContain("Vendor claimed.");
  });
});

describe("token and UI safety", () => {
  it("redacts claim-email body previews in logs", () => {
    expect(read("lib/email/vendor-claim-invite-email.ts")).toContain("sensitiveContent: true");
    expect(read("lib/email/email.service.ts")).toContain('input.sensitiveContent ? "[redacted]"');
  });

  it("uses a dedicated claim route rather than overloading pod invites", () => {
    expect(read("lib/auth/secure-invite-token.ts")).toContain("/claim/vendor/");
    expect(read("services/pod-vendor-invite.service.ts")).not.toContain("VendorClaimInvite");
  });

  it("shows ownership internally on admin vendor and pod surfaces", () => {
    expect(read("app/admin/(dashboard)/vendors/[vendorId]/AdminVendorOverview.tsx")).toContain(
      'title="Ownership"'
    );
    expect(read("app/admin/(dashboard)/pods/[podId]/AdminPodOverview.tsx")).toContain(
      "detailVendor.claimState.label"
    );
  });
});
