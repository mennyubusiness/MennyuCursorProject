import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const accountDir = join(dirname(fileURLToPath(import.meta.url)));
const root = join(process.cwd(), "src");

function readAccount(relativePath: string): string {
  return readFileSync(join(accountDir, relativePath), "utf8");
}

describe("account hub dashboard alignment", () => {
  it("uses hub-tier DashboardShell in account layout", () => {
    const layout = readAccount("layout.tsx");
    const styles = readFileSync(join(root, "components/dashboard/dashboard-styles.ts"), "utf8");

    expect(layout).toContain('tier="hub"');
    expect(layout).toContain("bg-oo-cream");
    expect(styles).toContain('hub: "mx-auto w-full max-w-3xl px-4"');
  });

  it("migrates hub sections to DashboardCard", () => {
    expect(readAccount("AccountProfileCard.tsx")).toContain("DashboardCard");
    expect(readAccount("AccountToolsGrid.tsx")).toContain("DashboardCard");
    expect(readAccount("AccountSecurityCard.tsx")).toContain("DashboardCard");
    expect(readAccount("AccountRecentOrders.tsx")).toContain("DashboardCard");
    expect(readAccount("AccountHubHeader.tsx")).toContain("DashboardCard");
  });

  it("uses DashboardStatusBadge for role labels in the header", () => {
    const header = readAccount("AccountHubHeader.tsx");
    expect(header).toContain("DashboardStatusBadge");
    expect(header).toContain("Pod owner");
    expect(header).not.toMatch(/vendor_owner|pod_owner/);
  });

  it("uses DashboardEmptyState for recent orders empty state", () => {
    const recent = readAccount("AccountRecentOrders.tsx");
    expect(recent).toContain("DashboardEmptyState");
    expect(recent).toContain("No orders yet");
  });
});

describe("account tools copy and routes", () => {
  it("formats membership roles for display without raw enum keys", () => {
    const tools = readAccount("AccountToolsGrid.tsx");
    const labels = readFileSync(join(root, "lib/account-membership-labels.ts"), "utf8");

    expect(tools).toContain("formatAccountMembershipRole");
    expect(tools).not.toMatch(/\.role\.replace\(/);
    expect(labels).toContain('"Owner"');
    expect(tools).toContain("Manage your vendor account");
    expect(tools).toContain("Set up payments, menu, and notifications");
    expect(tools).not.toMatch(/Stripe Connect|Deliverect/i);
  });

  it("keeps staff shortcut routes wired", () => {
    const tools = readAccount("AccountToolsGrid.tsx");
    expect(tools).toContain("ORDER_HISTORY_PATH");
    expect(tools).toContain("/admin");
    expect(tools).toContain("/kitchen");
    expect(tools).toContain("/settings");
  });

  it("only shows customer order tools in customer primary mode", () => {
    const page = readAccount("page.tsx");
    const tools = readAccount("AccountToolsGrid.tsx");
    expect(page).toContain('primaryMode === "customer"');
    expect(tools).toMatch(/primaryMode === "customer"/);
    expect(tools).toMatch(/primaryMode === "vendor"/);
  });
});

describe("account role and setup pages", () => {
  it("uses shared dashboard primitives on role picker", () => {
    const rolePage = readFileSync(join(accountDir, "(authenticated)/role/page.tsx"), "utf8");
    const picker = readFileSync(join(accountDir, "(authenticated)/role/RolePicker.tsx"), "utf8");

    expect(rolePage).toContain("DashboardCard");
    expect(picker).toContain("DashboardPageHeader");
    expect(picker).toContain('title: "Pod owner"');
    expect(picker).toContain('title: "Vendor"');
    expect(picker).toContain("{opt.title}");
    expect(picker).toContain("setRegistrationRole");
  });

  it("preserves setup form actions and redirects", () => {
    const customer = readFileSync(
      join(accountDir, "(authenticated)/setup/customer/CustomerSetupForm.tsx"),
      "utf8"
    );
    const pod = readFileSync(join(accountDir, "(authenticated)/setup/pod/PodSetupForm.tsx"), "utf8");
    const vendor = readFileSync(
      join(accountDir, "(authenticated)/setup/vendor/VendorSetupForm.tsx"),
      "utf8"
    );

    expect(customer).toContain("saveCustomerProfile");
    expect(customer).toContain('router.push("/orders")');
    expect(pod).toContain("createPodProfile");
    expect(pod).toContain("/pod/${r.podId}/dashboard");
    expect(vendor).toContain("createVendorProfile");
    expect(vendor).toContain("/vendor/${r.vendorId}");
  });

  it("wraps setup pages in DashboardCard", () => {
    expect(readFileSync(join(accountDir, "(authenticated)/setup/customer/page.tsx"), "utf8")).toContain(
      "DashboardCard"
    );
    expect(readFileSync(join(accountDir, "(authenticated)/setup/pod/page.tsx"), "utf8")).toContain(
      "DashboardCard"
    );
    expect(readFileSync(join(accountDir, "(authenticated)/setup/vendor/page.tsx"), "utf8")).toContain(
      "DashboardCard"
    );
  });

  it("uses warm oo tokens on setup forms instead of stone palette", () => {
    const vendor = readFileSync(
      join(accountDir, "(authenticated)/setup/vendor/VendorSetupForm.tsx"),
      "utf8"
    );
    expect(vendor).toContain("oo-input");
    expect(vendor).toContain("buttonClassName");
    expect(vendor).not.toMatch(/text-stone-900/);
    expect(vendor).toContain("connect your menu system");
    expect(vendor).not.toMatch(/payouts and POS connection/i);
  });
});

describe("orders page hub alignment", () => {
  it("uses hub-tier shell and shared primitives", () => {
    const layout = readFileSync(join(root, "app/orders/layout.tsx"), "utf8");
    const page = readFileSync(join(root, "app/orders/page.tsx"), "utf8");

    expect(layout).toContain('tier="hub"');
    expect(layout).toContain("bg-oo-cream");
    expect(page).toContain("DashboardPageHeader");
    expect(page).toContain("DashboardEmptyState");
    expect(page).toContain("getOrdersForSignedInUserAction");
    expect(page).toContain("ORDERS_SIGN_IN_PATH");
  });
});

describe("account-hub-styles.ts status", () => {
  it("keeps only shared muted text helper after card migration", () => {
    const styles = readAccount("account-hub-styles.ts");
    expect(styles).toContain("accountHubMutedClass");
    expect(styles).not.toContain("accountHubCardClass");
    expect(styles).not.toContain("accountHubSectionTitleClass");
  });
});
