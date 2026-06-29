import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, cache: <T extends (...args: never[]) => unknown>(fn: T) => fn };
});
vi.mock("@/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/group-order-participant-cookie", () => ({
  readGroupOrderParticipantMarkers: vi.fn().mockReturnValue({
    participantId: null,
    legacyJoinToken: null,
  }),
}));
vi.mock("@/lib/group-order-join-state", () => ({
  GROUP_ORDER_JOIN_COPY: {
    notFoundBody: "We couldn't find that group order. Check the code and try again.",
  },
  resolveGroupOrderJoinState: vi.fn(),
}));
vi.mock("@/services/cart.service", () => ({}));
vi.mock("@/services/group-order.service", () => ({}));
vi.mock("@/lib/group-order-cart-page", () => ({}));
vi.mock("@/lib/group-order-join-rate-limit", () => ({
  isGroupJoinCodeLookupRateLimited: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/rate-limit", () => ({
  RATE_LIMITS: {},
  RATE_LIMIT_ERROR_MESSAGE: "Too many requests.",
  enforceRateLimits: vi.fn().mockReturnValue(false),
  rateLimitKeys: {},
}));
vi.mock("@/lib/rate-limit-http", () => ({
  getClientIpFromHeaders: vi.fn().mockReturnValue("127.0.0.1"),
}));

import { validateGroupOrderJoinCodeAction } from "@/actions/group-order.actions";
import { resolveGroupOrderJoinState } from "@/lib/group-order-join-state";
import { isGroupJoinCodeLookupRateLimited } from "@/lib/group-order-join-rate-limit";

describe("validateGroupOrderJoinCodeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns inline validation for empty code", async () => {
    const result = await validateGroupOrderJoinCodeAction("   ");
    expect(result).toEqual({ ok: false, error: "Enter a group order code." });
    expect(resolveGroupOrderJoinState).not.toHaveBeenCalled();
  });

  it("returns inline validation for incomplete code", async () => {
    const result = await validateGroupOrderJoinCodeAction("123");
    expect(result).toEqual({ ok: false, error: "Code must be exactly 6 digits." });
    expect(resolveGroupOrderJoinState).not.toHaveBeenCalled();
  });

  it("returns not-found copy inside modal flow without navigating", async () => {
    vi.mocked(resolveGroupOrderJoinState).mockResolvedValue({ kind: "not_found" });
    const result = await validateGroupOrderJoinCodeAction("999999");
    expect(result).toEqual({
      ok: false,
      error: "We couldn't find that group order. Check the code and try again.",
    });
  });

  it("returns join path for a resolvable code", async () => {
    vi.mocked(resolveGroupOrderJoinState).mockResolvedValue({
      kind: "can_join",
      sessionId: "gos_1",
      podName: "Test Pod",
    });
    const result = await validateGroupOrderJoinCodeAction("123456");
    expect(result).toEqual({ ok: true, joinPath: "/group-order/join?code=123456" });
  });

  it("returns generic not-found copy when lookup is rate limited", async () => {
    vi.mocked(isGroupJoinCodeLookupRateLimited).mockReturnValue(true);
    const result = await validateGroupOrderJoinCodeAction("123456");
    expect(result).toEqual({
      ok: false,
      error: "We couldn't find that group order. Check the code and try again.",
    });
    expect(resolveGroupOrderJoinState).not.toHaveBeenCalled();
  });
});

describe("JoinGroupOrderByCodeModal wiring", () => {
  const modalSrc = readFileSync(
    join(process.cwd(), "src/components/group-order/JoinGroupOrderByCodeModal.tsx"),
    "utf8"
  );
  const heroActionsSrc = readFileSync(
    join(process.cwd(), "src/components/pod/PodPageHeroActions.tsx"),
    "utf8"
  );

  it("uses modal copy and validates before navigation", () => {
    expect(modalSrc).toMatch(/Join a group order/);
    expect(modalSrc).toMatch(/Enter the group order code shared by your host/);
    expect(modalSrc).toMatch(/validateGroupOrderJoinCodeAction/);
    expect(modalSrc).toMatch(/router\.push\(result\.joinPath\)/);
    expect(modalSrc).not.toMatch(/router\.push\(`\/group-order\/join\?podId=/);
  });

  it("supports modal accessibility basics", () => {
    expect(modalSrc).toMatch(/aria-modal="true"/);
    expect(modalSrc).toMatch(/Escape/);
    expect(modalSrc).toMatch(/htmlFor="join-group-order-code"/);
    expect(modalSrc).toMatch(/aria-describedby=\{error \? errorId : helperId\}/);
  });

  it("hero join button opens modal instead of linking to pod join route", () => {
    expect(heroActionsSrc).toMatch(/PodPageJoinWithCodeButton/);
    expect(heroActionsSrc).not.toMatch(/group-order\/join\?podId=/);
  });

  it("Quick Cart join button opens modal instead of bare join route", () => {
    const quickCartGroupSrc = readFileSync(
      join(process.cwd(), "src/components/cart/QuickCartGroupSection.tsx"),
      "utf8"
    );
    expect(quickCartGroupSrc).toMatch(/JoinGroupOrderByCodeModal/);
    expect(quickCartGroupSrc).not.toMatch(/href="\/group-order\/join"/);
  });
});
