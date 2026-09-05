import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const src = join(root, "src");
const read = (path: string) => readFileSync(join(src, path), "utf8");

describe("PodClaimInvite schema and migration", () => {
  const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
  const migration = readFileSync(
    join(root, "prisma/migrations/20260905043000_pod_claim_invite/migration.sql"),
    "utf8"
  );

  it("stores only a unique hash with expiry, revoke, and single-use fields", () => {
    expect(schema).toMatch(/model PodClaimInvite[\s\S]*tokenHash\s+String\s+@unique/);
    expect(schema).toMatch(/model PodClaimInvite[\s\S]*podId\s+String\s+@unique/);
    expect(schema).toMatch(/model PodClaimInvite[\s\S]*expiresAt\s+DateTime/);
    expect(schema).toMatch(/model PodClaimInvite[\s\S]*claimedAt\s+DateTime\?/);
    expect(schema).toMatch(/model PodClaimInvite[\s\S]*revokedAt\s+DateTime\?/);
    expect(schema).not.toMatch(/model PodClaimInvite[\s\S]{0,700}\btoken\s+String/);
  });

  it("is additive and does not mutate existing business data", () => {
    expect(migration).toContain('CREATE TABLE "PodClaimInvite"');
    expect(migration).not.toMatch(/UPDATE\s+"(Pod|Vendor|MenuItem|PodVendor)"/i);
    expect(migration).not.toMatch(/orderingEnabled|menuSource|orderRoutingMode|stripe|square|deliverect/i);
  });
});

describe("authorization and ownership separation", () => {
  it("keeps ownership in PodMembership rather than Pod.ownerId", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    const podModel = schema.slice(schema.indexOf("model Pod {"), schema.indexOf("model PodPayoutSettings"));
    expect(podModel).not.toMatch(/\bownerId\b/);
    expect(podModel).toContain("memberships");
  });

  it("keeps existing self-service creation creating an owner", () => {
    const setup = read("actions/account-setup.actions.ts");
    expect(setup).toMatch(/prisma\.pod\.create[\s\S]{0,900}?memberships/);
    expect(setup).toMatch(/role:\s*PodMembershipRole\.owner/);
  });

  it("keeps all concierge and invite controls behind platform admin actions", () => {
    const actions = read("actions/admin-pod.actions.ts");
    for (const action of [
      "adminCreateUnclaimedPodAction",
      "adminSendPodClaimInviteAction",
      "adminResendPodClaimInviteAction",
      "adminRevokePodClaimInviteAction",
    ]) {
      expect(actions).toMatch(new RegExp(`${action}[\\s\\S]{0,500}?withAdmin`));
    }
  });
});

describe("public and ordering behavior", () => {
  it("does not add claim state to public readiness", () => {
    for (const file of [
      "lib/vendor-readiness-states.ts",
      "lib/vendor-ordering-mode.ts",
      "lib/vendor-orderability-in-pod.ts",
      "lib/pod-customer-page-data.ts",
      "lib/pod-page-status.ts",
    ]) {
      expect(read(file)).not.toMatch(/claimState|claimInvite|PodClaimInvite/);
    }
  });

  it("does not expose claim or unclaimed copy on customer components", () => {
    for (const file of [
      "components/pod/PodVendorCard.tsx",
      "components/vendor-menu/VendorMenuHero.tsx",
    ]) {
      expect(read(file)).not.toMatch(/\bUnclaimed\b|Claim this pod|Owner not registered/);
    }
  });
});

describe("claim authentication and first login", () => {
  it("allows pod claim paths through safe post-login routing", () => {
    const routing = read("lib/auth/post-login-destination.ts");
    expect(routing).toContain("isOwnershipClaimPath");
    expect(routing).toMatch(/pendingSetup[\s\S]{0,200}?isOwnershipClaimPath/);
  });

  it("returns new registrations directly to the claim page", () => {
    const register = read("app/register/RegisterForm.tsx");
    expect(register).toContain("verificationReturnPath");
    expect(register).toMatch(
      /isOwnershipClaimPath\(returnPathSafe\)[\s\S]{0,250}?router\.push\(returnPathSafe\)/
    );
  });

  it("preserves the claim path through email verification", () => {
    const service = read("services/email-verification.service.ts");
    const page = read("app/verify-email/page.tsx");
    expect(service).toContain("isOwnershipClaimPath");
    expect(page).toContain("ownershipClaimContinueLabel");
  });

  it("shows only one concise claimed success message", () => {
    const dashboard = read("app/pod/[podId]/dashboard/page.tsx");
    expect(dashboard).toContain('query.claimed === "1"');
    expect(dashboard).toContain("Pod claimed.");
  });
});

describe("token and UI safety", () => {
  it("redacts claim-email body previews in logs", () => {
    expect(read("lib/email/pod-claim-invite-email.ts")).toContain("sensitiveContent: true");
  });

  it("uses a dedicated claim route rather than overloading pod vendor invites", () => {
    expect(read("lib/auth/secure-invite-token.ts")).toContain("/claim/pod/");
    expect(read("services/pod-vendor-invite.service.ts")).not.toContain("PodClaimInvite");
  });

  it("shows ownership internally on admin pod surfaces", () => {
    expect(read("app/admin/(dashboard)/pods/[podId]/AdminPodOverview.tsx")).toContain(
      'title="Ownership"'
    );
    expect(read("app/admin/(dashboard)/pods/page.tsx")).toContain("Unclaimed");
  });
});
