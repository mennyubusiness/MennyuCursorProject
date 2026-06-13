import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin-auth", () => ({
  isAdminDashboardLayoutAuthorized: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "admin-1", email: "admin@test.com" } })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    vendor: { findUnique: vi.fn() },
    webhookEvent: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const mockDisconnect = vi.fn();
const mockManualReconnect = vi.fn();
const mockApplyStored = vi.fn();
const mockMenuPull = vi.fn();
const mockRetryMatch = vi.fn();

vi.mock("@/services/admin-deliverect-connection.service", () => ({
  disconnectVendorFromDeliverect: (...args: unknown[]) => mockDisconnect(...args),
  adminManualReconnectDeliverect: (...args: unknown[]) => mockManualReconnect(...args),
  adminApplyStoredChannelRegistrationPayload: (...args: unknown[]) => mockApplyStored(...args),
}));

vi.mock("@/services/deliverect-menu-pull-ingest.service", () => ({
  pullDeliverectMenuAndIngestPhase1b: (...args: unknown[]) => mockMenuPull(...args),
}));

vi.mock("@/services/deliverect-channel-registration-retry.service", () => ({
  retryChannelRegistrationMatchForWebhookEventById: (...args: unknown[]) => mockRetryMatch(...args),
}));

import { isAdminDashboardLayoutAuthorized } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import {
  adminApplyChannelRegistrationPayloadToVendor,
  adminDisconnectDeliverectConnection,
  adminManualReconnectDeliverectConnection,
  adminRetryChannelRegistrationMatch,
  adminTriggerDeliverectMenuPull,
} from "@/actions/admin-deliverect-connections.actions";

describe("admin deliverect connection actions authorization", () => {
  beforeEach(() => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockReset();
    mockDisconnect.mockReset();
    mockManualReconnect.mockReset();
    mockApplyStored.mockReset();
    mockMenuPull.mockReset();
    mockRetryMatch.mockReset();
  });

  it("blocks non-admin apply payload", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const res = await adminApplyChannelRegistrationPayloadToVendor("ev1", "v1");
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockApplyStored).not.toHaveBeenCalled();
  });

  it("blocks non-admin manual reconnect", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const res = await adminManualReconnectDeliverectConnection({
      targetVendorId: "v1",
      channelLinkId: "cl1",
      forceTransfer: false,
    });
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockManualReconnect).not.toHaveBeenCalled();
  });

  it("blocks non-admin disconnect", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const res = await adminDisconnectDeliverectConnection("v1");
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockDisconnect).not.toHaveBeenCalled();
  });

  it("blocks non-admin menu pull", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const res = await adminTriggerDeliverectMenuPull("v1");
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockMenuPull).not.toHaveBeenCalled();
  });

  it("blocks non-admin retry match", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(false);
    const res = await adminRetryChannelRegistrationMatch("ev1");
    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockRetryMatch).not.toHaveBeenCalled();
  });

  it("allows admin disconnect and delegates to service", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    mockDisconnect.mockResolvedValue({ vendorId: "v1", vendorName: "Test Vendor" });

    const res = await adminDisconnectDeliverectConnection("v1");
    expect(res.ok).toBe(true);
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("allows admin apply payload", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    mockApplyStored.mockResolvedValue({
      ok: true,
      outcome: "admin_payload_apply",
      targetVendorId: "billy-v",
      channelLinkId: "694c302376b27b4e7266dd23",
      disconnectedVendors: [],
    });

    const res = await adminApplyChannelRegistrationPayloadToVendor("ev1", "billy-v", true);
    expect(res.ok).toBe(true);
    expect(mockApplyStored).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        webhookEventId: "ev1",
        targetVendorId: "billy-v",
        forceTransfer: true,
      })
    );
  });

  it("allows admin menu pull when vendor connected", async () => {
    vi.mocked(isAdminDashboardLayoutAuthorized).mockResolvedValue(true);
    vi.mocked(prisma.vendor.findUnique).mockResolvedValue({
      id: "v1",
      name: "Billy",
      deliverectChannelLinkId: "694c302376b27b4e7266dd23",
    } as never);
    mockMenuPull.mockResolvedValue({
      jobId: "job1",
      jobStatus: "pending",
      draftVersionId: "dv1",
      issueCount: 0,
    });

    const res = await adminTriggerDeliverectMenuPull("v1");
    expect(res.ok).toBe(true);
    expect(mockMenuPull).toHaveBeenCalledWith({ vendorId: "v1" });
  });
});
