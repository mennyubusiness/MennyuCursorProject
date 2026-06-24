import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd());

describe("pod payout connect P3 guardrails", () => {
  it("User schema includes pod payout Stripe fields separate from Vendor", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    expect(schema).toContain("podPayoutStripeConnectedAccountId");
    expect(schema).toContain("podPayoutStripeChargesEnabled");
    expect(schema).toContain("podPayoutStripePayoutsEnabled");
    const userBlock = schema.slice(schema.indexOf("model User {"), schema.indexOf("model PasswordResetToken"));
    expect(userBlock).toContain("podPayoutStripeConnectedAccountId");
    expect(userBlock).not.toContain("stripeConnectedAccountId");
  });

  it("pod payout connect service does not import VendorPayoutTransfer or stripe.transfers.create", () => {
    const service = readFileSync(
      join(root, "src/services/pod-payout-connect.service.ts"),
      "utf8"
    );
    expect(service).not.toContain("VendorPayoutTransfer");
    expect(service).not.toMatch(/transfers\.create/i);
    expect(service).not.toContain("stripeConnectedAccountId");
  });

  it("vendor stripe connect actions remain vendor-scoped", () => {
    const vendorActions = readFileSync(
      join(root, "src/actions/vendor-stripe-connect.actions.ts"),
      "utf8"
    );
    expect(vendorActions).toContain("createVendorConnectedAccount");
    expect(vendorActions).not.toContain("podPayout");
  });

  it("pod settings setup card avoids earnings language", () => {
    const card = readFileSync(
      join(root, "src/app/pod/[podId]/settings/PodPayoutSetupCard.tsx"),
      "utf8"
    );
    expect(card).toContain("Payout account");
    expect(card).toContain("Manage payout account");
    expect(card).not.toMatch(/earnings are available|your earnings/i);
    expect(card).not.toMatch(/stripe\.transfers\.create/i);
    expect(card.toLowerCase()).not.toContain("designated recipient");
    expect(card.toLowerCase()).not.toContain("earnings available");
  });

  it("pod dashboard still has no payout amounts", () => {
    const metrics = readFileSync(
      join(root, "src/app/pod/[podId]/dashboard/PodDashboardMetrics.tsx"),
      "utf8"
    );
    expect(metrics).not.toMatch(/podPayoutAmount|PodPayoutAllocation/i);
  });
});
