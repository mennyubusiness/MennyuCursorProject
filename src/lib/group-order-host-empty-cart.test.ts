import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("GroupOrderHostEmptyCartCard", () => {
  const cardSrc = readFileSync(
    join(process.cwd(), "src/app/cart/GroupOrderHostEmptyCartCard.tsx"),
    "utf8"
  );
  const pageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
  const inviteSrc = readFileSync(
    join(process.cwd(), "src/app/cart/GroupOrderInviteShareControls.tsx"),
    "utf8"
  );

  it("uses a single empty-cart-first card layout", () => {
    expect(cardSrc).toMatch(/Your group cart is empty/);
    expect(cardSrc).toMatch(/Add items from any vendor at \{podName\}/);
    expect(cardSrc).toMatch(/Group order open/);
    expect(cardSrc).toMatch(/Host pays at checkout/);
    expect(cardSrc).toMatch(/EndGroupOrderHostButton/);
  });

  it("prioritizes add items and keeps invite secondary", () => {
    expect(cardSrc).toMatch(/ButtonLink href=\{`\/pod\/\$\{podId\}`\} variant="primary"/);
    expect(cardSrc).toMatch(/Invite people/);
    expect(cardSrc).toMatch(/variant="compact"/);
    expect(cardSrc).not.toMatch(/Group cart created/);
  });

  it("cart page renders only the unified card for host_group_empty", () => {
    expect(pageSrc).toMatch(/host_group_empty/);
    expect(pageSrc).toMatch(/GroupOrderHostEmptyCartCard/);
    expect(pageSrc).not.toMatch(/GroupOrderHostEmptyCartState/);
    expect(pageSrc).toMatch(
      /if \(emptyStateKind === "host_group_empty"\) \{[\s\S]*?GroupOrderHostEmptyCartCard[\s\S]*?\n  \}/
    );
  });

  it("compact invite section uses secondary copy and share actions", () => {
    expect(inviteSrc).toMatch(/Invite friends/);
    expect(inviteSrc).toMatch(/Share this 6-digit code or link so friends can join/);
    expect(inviteSrc).toMatch(/Copy code/);
    expect(inviteSrc).toMatch(/Copy link/);
    expect(inviteSrc).toMatch(/QR code/);
    expect(inviteSrc).toMatch(/Share/);
  });
});
