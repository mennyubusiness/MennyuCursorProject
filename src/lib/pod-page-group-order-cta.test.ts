import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ get: () => undefined }),
}));
vi.mock("@/lib/group-order-participant-cookie", () => ({
  readGroupOrderParticipantMarkers: vi.fn().mockReturnValue({
    participantId: null,
    legacyJoinToken: null,
  }),
}));
vi.mock("@/lib/group-participant-order-access", () => ({
  resolveGroupParticipantForSession: vi.fn(),
}));
vi.mock("@/lib/group-order-session-lifecycle", () => ({
  expireGroupOrderSessionIfStale: vi.fn(),
}));

const mockResolveActiveGroupCartIdForPod = vi.fn();
const mockFindSessionByCartId = vi.fn();
const mockResolveActorForGroupCart = vi.fn();

vi.mock("@/services/group-order.service", () => ({
  resolveActiveGroupCartIdForPod: (...args: unknown[]) => mockResolveActiveGroupCartIdForPod(...args),
  findSessionByCartId: (...args: unknown[]) => mockFindSessionByCartId(...args),
  resolveActorForGroupCart: (...args: unknown[]) => mockResolveActorForGroupCart(...args),
}));

import { resolvePodPageGroupOrderCtaState } from "./pod-page-group-order-cta";
import { resolveGroupParticipantForSession } from "@/lib/group-participant-order-access";

const POD_ID = "pod_1";
const CART_ID = "cart_1";
const HOST_USER = "user_host";
const markers = { participantId: null, legacyJoinToken: null };

describe("resolvePodPageGroupOrderCtaState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(null);
  });

  it("shows start when no active group cart for pod", async () => {
    const state = await resolvePodPageGroupOrderCtaState(POD_ID, {
      hostUserId: HOST_USER,
      participantMarkers: markers,
    });
    expect(state).toEqual({ kind: "start" });
  });

  it("shows host_active when signed-in host has active group on pod", async () => {
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(CART_ID);
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      podId: POD_ID,
      hostUserId: HOST_USER,
      status: "active",
    });

    const state = await resolvePodPageGroupOrderCtaState(POD_ID, {
      hostUserId: HOST_USER,
      participantMarkers: markers,
    });
    expect(state).toEqual({ kind: "host_active" });
  });

  it("shows locked_checkout for host when session is locked", async () => {
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(CART_ID);
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      podId: POD_ID,
      hostUserId: HOST_USER,
      status: "locked_checkout",
    });

    const state = await resolvePodPageGroupOrderCtaState(POD_ID, {
      hostUserId: HOST_USER,
      participantMarkers: markers,
    });
    expect(state).toEqual({ kind: "locked_checkout" });
  });

  it("shows participant_active for participant in active group", async () => {
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(CART_ID);
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      podId: POD_ID,
      hostUserId: "other_host",
      status: "active",
    });
    vi.mocked(resolveGroupParticipantForSession).mockResolvedValue({
      id: "part_1",
      role: "participant",
      displayName: "Alex",
      groupOrderSessionId: "gos_1",
      leftAt: null,
    });

    const state = await resolvePodPageGroupOrderCtaState(POD_ID, {
      hostUserId: null,
      participantMarkers: { participantId: "part_1", legacyJoinToken: null },
    });
    expect(state).toEqual({ kind: "participant_active" });
  });

  it("shows start again when session is submitted", async () => {
    mockResolveActiveGroupCartIdForPod.mockResolvedValue(CART_ID);
    mockFindSessionByCartId.mockResolvedValue({
      id: "gos_1",
      podId: POD_ID,
      hostUserId: HOST_USER,
      status: "submitted",
    });

    const state = await resolvePodPageGroupOrderCtaState(POD_ID, {
      hostUserId: HOST_USER,
      participantMarkers: markers,
    });
    expect(state).toEqual({ kind: "start" });
  });
});

describe("pod page group CTA wiring", () => {
  const podPageSrc = readFileSync(join(process.cwd(), "src/app/pod/[podId]/page.tsx"), "utf8");
  const sectionSrc = readFileSync(
    join(process.cwd(), "src/components/pod/PodPageGroupOrderSection.tsx"),
    "utf8"
  );

  it("pod page delegates group CTA to PodPageGroupOrderSection", () => {
    expect(podPageSrc).toMatch(/PodPageGroupOrderSection/);
    expect(podPageSrc).not.toMatch(/Start group order/);
  });

  it("shows Group order started for host active state", () => {
    expect(sectionSrc).toMatch(/Group order started/);
    expect(sectionSrc).toMatch(/Open Quick Cart to invite friends or add items/);
    expect(sectionSrc).toMatch(/kind === "host_active"/);
  });

  it("hides start button for participant active group", () => {
    expect(sectionSrc).toMatch(/You&apos;re in a group order/);
    expect(sectionSrc).toMatch(/participant_active/);
    const participantBranch = sectionSrc.split('kind === "participant_active"')[1] ?? "";
    expect(participantBranch).not.toMatch(/Start group order/);
  });

  it("still shows start CTA when kind is start", () => {
    expect(sectionSrc).toMatch(/Start group order/);
    expect(sectionSrc).toMatch(/kind === "start"/);
  });
});
