import { describe, expect, it } from "vitest";

import { buildAccountPageContext } from "./account-page-view-model";

describe("buildAccountPageContext", () => {
  it("returns signed-out state when no User session", () => {
    const ctx = buildAccountPageContext({
      customerSession: null,
      customerAccount: null,
      session: null,
      staffMemberships: null,
      showAdminLink: false,
    });

    expect(ctx.isSignedIn).toBe(false);
    expect(ctx.emailAccount).toBeNull();
    expect(ctx.checkoutPhone).toBeNull();
    expect(ctx.staff).toBeNull();
  });

  it("shows signed-in User identity", () => {
    const ctx = buildAccountPageContext({
      customerSession: null,
      customerAccount: null,
      session: {
        user: {
          id: "user_1",
          email: "customer@example.com",
          name: "Customer User",
          isPlatformAdmin: false,
        },
        expires: "2099-01-01T00:00:00.000Z",
      },
      staffMemberships: {
        isPlatformAdmin: false,
        vendorMemberships: [],
        podMemberships: [],
      },
      showAdminLink: false,
    });

    expect(ctx.isSignedIn).toBe(true);
    expect(ctx.emailAccount?.email).toBe("customer@example.com");
    expect(ctx.checkoutPhone).toBeNull();
    expect(ctx.staff).toBeNull();
  });

  it("shows checkout phone as contact info when User is signed in", () => {
    const ctx = buildAccountPageContext({
      customerSession: {
        customerAccountId: "ca_1",
        phoneE164: "+15551234567",
        sessionId: "sess_1",
      },
      customerAccount: {
        phoneE164: "+15551234567",
        phoneVerifiedAt: new Date("2026-01-01"),
      },
      session: {
        user: {
          id: "user_1",
          email: "customer@example.com",
          name: null,
          isPlatformAdmin: false,
        },
        expires: "2099-01-01T00:00:00.000Z",
      },
      staffMemberships: {
        isPlatformAdmin: false,
        vendorMemberships: [],
        podMemberships: [],
      },
      showAdminLink: false,
    });

    expect(ctx.checkoutPhone?.phoneDisplay).toBe("+1 ••• ••• 4567");
  });

  it("shows staff access for operational users", () => {
    const ctx = buildAccountPageContext({
      customerSession: null,
      customerAccount: null,
      session: {
        user: {
          id: "user_1",
          email: "ops@openorder.co",
          name: "Ops User",
          isPlatformAdmin: true,
        },
        expires: "2099-01-01T00:00:00.000Z",
      },
      staffMemberships: {
        isPlatformAdmin: true,
        vendorMemberships: [
          {
            vendorId: "v_1",
            role: "owner",
            vendor: { name: "Taco Stand" },
          },
        ],
        podMemberships: [],
      },
      showAdminLink: true,
    });

    expect(ctx.staff?.isPlatformAdmin).toBe(true);
    expect(ctx.staff?.vendorMemberships[0]?.href).toBe("/vendor/v_1");
  });
});
