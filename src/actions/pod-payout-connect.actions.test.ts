import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/public-site-url", () => ({
  getPublicSiteOrigin: vi.fn(async () => "https://example.com"),
}));

const mockLoadContext = vi.fn();
const mockIsRecipient = vi.fn();
const mockCreateOnboardingLink = vi.fn();
const mockCreateManagementLink = vi.fn();
const mockSync = vi.fn();

vi.mock("@/services/pod-payout-connect.service", () => ({
  loadPodPayoutRecipientContext: (...args: unknown[]) => mockLoadContext(...args),
  isUserDesignatedPodPayoutRecipient: (...args: unknown[]) => mockIsRecipient(...args),
  createPodPayoutOnboardingLink: (...args: unknown[]) => mockCreateOnboardingLink(...args),
  createPodPayoutAccountManagementLink: (...args: unknown[]) => mockCreateManagementLink(...args),
  syncPodPayoutConnectedAccountStatus: (...args: unknown[]) => mockSync(...args),
  StripeConnectNotConfiguredError: class StripeConnectNotConfiguredError extends Error {
    name = "StripeConnectNotConfiguredError";
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { auth } from "@/auth";
import {
  openPodPayoutAccountManagement,
  startPodPayoutConnectOnboarding,
  syncPodPayoutConnectStatusAction,
} from "@/actions/pod-payout-connect.actions";

describe("pod payout connect actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_owner" } } as never);
    mockLoadContext.mockResolvedValue({
      podId: "pod_1",
      podPayoutsEnabled: true,
      podPayoutRecipientUserId: "user_owner",
    });
    mockIsRecipient.mockResolvedValue(true);
    mockCreateOnboardingLink.mockResolvedValue("https://stripe.test/onboard");
    mockCreateManagementLink.mockResolvedValue("https://stripe.test/manage");
    mockSync.mockResolvedValue(undefined);
  });

  it("allows payout account owner to start onboarding", async () => {
    const result = await startPodPayoutConnectOnboarding("pod_1");
    expect(result).toEqual({ ok: true, url: "https://stripe.test/onboard" });
    expect(mockCreateOnboardingLink).toHaveBeenCalledWith(
      "user_owner",
      expect.stringContaining("/pod/pod_1/settings?pod_payout_connect=return"),
      expect.stringContaining("/pod/pod_1/settings?pod_payout_connect=refresh"),
      { podId: "pod_1" }
    );
  });

  it("allows payout account owner to open account management", async () => {
    const result = await openPodPayoutAccountManagement("pod_1");
    expect(result).toEqual({ ok: true, url: "https://stripe.test/manage" });
    expect(mockCreateManagementLink).toHaveBeenCalledWith(
      "user_owner",
      expect.stringContaining("/pod/pod_1/settings?pod_payout_connect=return"),
      expect.stringContaining("/pod/pod_1/settings?pod_payout_connect=refresh")
    );
  });

  it("blocks non-owner pod member from starting onboarding", async () => {
    mockIsRecipient.mockResolvedValue(false);
    const result = await startPodPayoutConnectOnboarding("pod_1");
    expect(result.ok).toBe(false);
    expect(mockCreateOnboardingLink).not.toHaveBeenCalled();
  });

  it("blocks non-owner pod member from opening account management", async () => {
    mockIsRecipient.mockResolvedValue(false);
    const result = await openPodPayoutAccountManagement("pod_1");
    expect(result.ok).toBe(false);
    expect(mockCreateManagementLink).not.toHaveBeenCalled();
  });

  it("blocks admin who is not the payout account owner from starting onboarding", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_admin" } } as never);
    mockIsRecipient.mockResolvedValue(false);
    const result = await startPodPayoutConnectOnboarding("pod_1");
    expect(result.ok).toBe(false);
    expect(mockCreateOnboardingLink).not.toHaveBeenCalled();
  });

  it("blocks admin who is not the payout account owner from opening account management", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user_admin" } } as never);
    mockIsRecipient.mockResolvedValue(false);
    const result = await openPodPayoutAccountManagement("pod_1");
    expect(result.ok).toBe(false);
    expect(mockCreateManagementLink).not.toHaveBeenCalled();
  });

  it("blocks onboarding when payouts disabled", async () => {
    mockLoadContext.mockResolvedValue({
      podId: "pod_1",
      podPayoutsEnabled: false,
      podPayoutRecipientUserId: "user_owner",
    });
    const result = await startPodPayoutConnectOnboarding("pod_1");
    expect(result.ok).toBe(false);
    expect(mockCreateOnboardingLink).not.toHaveBeenCalled();
  });

  it("blocks manager/non-owner sync", async () => {
    mockIsRecipient.mockResolvedValue(false);
    const result = await syncPodPayoutConnectStatusAction("pod_1");
    expect(result).toEqual({
      ok: false,
      error: "You don’t have permission to refresh payout setup for this pod.",
    });
    expect(mockSync).not.toHaveBeenCalled();
  });

  it("allows payout account owner to sync status", async () => {
    const result = await syncPodPayoutConnectStatusAction("pod_1");
    expect(result).toEqual({ ok: true });
    expect(mockSync).toHaveBeenCalledWith("user_owner");
  });
});
