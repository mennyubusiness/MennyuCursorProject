import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Quick Cart host group controls UX", () => {
  const hostControlsSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartHostGroupControls.tsx"),
    "utf8"
  );
  const groupSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
    "utf8"
  );
  const drawerSrc = readFileSync(
    join(process.cwd(), "src/components/cart/QuickCartDrawer.tsx"),
    "utf8"
  );
  const qrModalSrc = readFileSync(
    join(process.cwd(), "src/components/group-order/GroupOrderInviteQrModal.tsx"),
    "utf8"
  );

  it("defaults to compact collapsed invite controls", () => {
    expect(hostControlsSrc).toMatch(/inviteExpanded/);
    expect(hostControlsSrc).toMatch(/Invite options/);
    expect(hostControlsSrc).toMatch(/Invite friends to add their items/);
  });

  it("default visible actions are Copy code and Invite options only", () => {
    expect(hostControlsSrc).toMatch(/Copy code/);
    expect(hostControlsSrc).toMatch(/Invite options/);
    const beforeExpanded = hostControlsSrc.split("{inviteExpanded ?")[0] ?? "";
    expect(beforeExpanded).not.toMatch(/Copy invite link/);
    expect(beforeExpanded).not.toMatch(/Show QR code/);
    expect(beforeExpanded).not.toMatch(/>\s*Share\s*</);
  });

  it("expanded invite options show link, QR, and Share", () => {
    expect(hostControlsSrc).toMatch(/inviteExpanded \?/);
    expect(hostControlsSrc).toMatch(/Copy invite link/);
    expect(hostControlsSrc).toMatch(/Show QR code/);
    expect(hostControlsSrc).toMatch(/Share/);
    expect(hostControlsSrc).toMatch(/Friends can join with the code or QR link/);
  });

  it("does not duplicate Add items or Open group cart in host card", () => {
    expect(hostControlsSrc).not.toMatch(/Add items/);
    expect(hostControlsSrc).not.toMatch(/Open group cart/);
    expect(hostControlsSrc).not.toMatch(/\/cart#group-order-invite/);
  });

  it("opens QR modal in Quick Cart instead of navigating to cart", () => {
    expect(hostControlsSrc).toMatch(/GroupOrderInviteQrModal/);
    expect(hostControlsSrc).toMatch(/setQrOpen\(true\)/);
    expect(hostControlsSrc).not.toMatch(/href=\"\/cart#group-order-invite\"/);
    expect(hostControlsSrc).not.toMatch(/href=\{\`\/cart/);
  });

  it("QR encodes code-only join path, not joinToken", () => {
    expect(qrModalSrc).toMatch(/buildGroupOrderJoinPath/);
    expect(hostControlsSrc).not.toMatch(/joinToken/i);
    expect(qrModalSrc).not.toMatch(/joinToken/i);
  });

  it("participant card uses updated copy", () => {
    expect(groupSrc).toMatch(/You&apos;re in a group order/);
    expect(groupSrc).toMatch(/Add your items before the host checks out/);
  });

  it("drawer footer still routes to group cart", () => {
    expect(drawerSrc).toMatch(/quickCartFooterCtaLabel/);
    expect(drawerSrc).toMatch(/footerCta/);
    expect(drawerSrc).toMatch(/href=\"\/cart\"/);
  });
});

describe("full cart invite controls unchanged", () => {
  const panelSrc = readFileSync(join(process.cwd(), "src/app/cart/GroupOrderCartPanel.tsx"), "utf8");
  const inviteSrc = readFileSync(
    join(process.cwd(), "src/app/cart/GroupOrderInviteShareControls.tsx"),
    "utf8"
  );

  it("still renders GroupOrderInviteShareControls on cart page", () => {
    expect(panelSrc).toMatch(/GroupOrderInviteShareControls/);
    expect(inviteSrc).toMatch(/Copy code/);
    expect(inviteSrc).toMatch(/QR code/);
    expect(inviteSrc).toMatch(/GroupOrderInviteQrModal/);
  });
});
