import { describe, expect, it } from "vitest";



import { buildAccountPageContext } from "./account-page-view-model";



describe("buildAccountPageContext", () => {

  it("returns signed-out state when no User session", () => {

    const ctx = buildAccountPageContext({

      customerSession: null,

      sessionCustomerAccount: null,

      userLinkedAccount: null,

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

      sessionCustomerAccount: null,

      userLinkedAccount: null,

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



  it("shows linkable checkout phone when session is unlinked", () => {

    const ctx = buildAccountPageContext({

      customerSession: {

        customerAccountId: "ca_1",

        phoneE164: "+15551234567",

        sessionId: "sess_1",

      },

      sessionCustomerAccount: {

        phoneE164: "+15551234567",

        phoneVerifiedAt: new Date("2026-01-01"),

        userId: null,

      },

      userLinkedAccount: null,

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

    expect(ctx.checkoutPhone?.linkStatus).toBe("linkable");

    expect(ctx.checkoutPhone?.linkStatusLabel).toBe("Not linked yet");

    expect(ctx.checkoutPhone?.canLink).toBe(true);

  });



  it("shows linked status when session account matches user", () => {

    const ctx = buildAccountPageContext({

      customerSession: {

        customerAccountId: "ca_1",

        phoneE164: "+15551234567",

        sessionId: "sess_1",

      },

      sessionCustomerAccount: {

        phoneE164: "+15551234567",

        phoneVerifiedAt: new Date("2026-01-01"),

        userId: "user_1",

      },

      userLinkedAccount: { id: "ca_1", phoneE164: "+15551234567" },

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



    expect(ctx.checkoutPhone?.linkStatus).toBe("linked");

    expect(ctx.checkoutPhone?.canLink).toBe(false);

  });



  it("shows linked_other when session phone belongs to another user", () => {

    const ctx = buildAccountPageContext({

      customerSession: {

        customerAccountId: "ca_1",

        phoneE164: "+15551234567",

        sessionId: "sess_1",

      },

      sessionCustomerAccount: {

        phoneE164: "+15551234567",

        phoneVerifiedAt: new Date("2026-01-01"),

        userId: "user_other",

      },

      userLinkedAccount: null,

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



    expect(ctx.checkoutPhone?.linkStatus).toBe("linked_other");

    expect(ctx.checkoutPhone?.canLink).toBe(false);

  });



  it("shows user linked phone without device session", () => {

    const ctx = buildAccountPageContext({

      customerSession: null,

      sessionCustomerAccount: null,

      userLinkedAccount: { id: "ca_1", phoneE164: "+15551234567" },

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



    expect(ctx.checkoutPhone?.linkStatus).toBe("linked");

    expect(ctx.checkoutPhone?.canLink).toBe(false);

  });



  it("shows staff access for operational users", () => {

    const ctx = buildAccountPageContext({

      customerSession: null,

      sessionCustomerAccount: null,

      userLinkedAccount: null,

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


