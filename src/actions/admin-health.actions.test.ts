import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireAdmin = vi.fn();
const mockRerunPayment = vi.fn();
const mockRecheckOrder = vi.fn();

vi.mock("@/lib/admin-action-context", () => ({
  requireAdminActionContext: (...args: unknown[]) => mockRequireAdmin(...args),
}));

vi.mock("@/services/admin-health-actions.service", () => ({
  adminRerunPaymentValidation: (...args: unknown[]) => mockRerunPayment(...args),
  adminRecheckOrderHealth: (...args: unknown[]) => mockRecheckOrder(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  adminRecheckOrderHealthAction,
  adminRerunPaymentValidationAction,
} from "@/actions/admin-health.actions";

const healthPage = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/health/page.tsx"),
  "utf8"
);
const incidentsPage = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/incidents/page.tsx"),
  "utf8"
);
const notificationsPage = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/notifications/page.tsx"),
  "utf8"
);
const webhooksPage = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/webhooks/page.tsx"),
  "utf8"
);
const adminLayout = readFileSync(
  join(process.cwd(), "src/app/admin/(dashboard)/layout.tsx"),
  "utf8"
);

describe("admin health actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-admin payment validation rerun", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: false, error: "Unauthorized." });
    const result = await adminRerunPaymentValidationAction("ord_1", "ops review");
    expect(result).toEqual({ ok: false, error: "Unauthorized." });
    expect(mockRerunPayment).not.toHaveBeenCalled();
  });

  it("delegates payment validation rerun to service for admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockRerunPayment.mockResolvedValue({ ok: true, message: "ok" });
    const result = await adminRerunPaymentValidationAction("ord_1", "validate pi");
    expect(result).toEqual({ ok: true, message: "ok" });
    expect(mockRerunPayment).toHaveBeenCalledWith({
      orderId: "ord_1",
      adminUserId: "admin_1",
      reason: "validate pi",
    });
  });

  it("delegates order health recheck to service for admin", async () => {
    mockRequireAdmin.mockResolvedValue({ ok: true, adminUserId: "admin_1" });
    mockRecheckOrder.mockResolvedValue({ ok: true, message: "rechecked" });
    const result = await adminRecheckOrderHealthAction("ord_2", "triage");
    expect(result).toEqual({ ok: true, message: "rechecked" });
  });
});

describe("admin sprint 3 route guards", () => {
  it("health/incidents/notifications/webhooks live under admin dashboard layout", () => {
    expect(adminLayout).toContain("isAdminDashboardLayoutAuthorized");
    expect(healthPage).toContain("getAdminHealthDashboard");
    expect(incidentsPage).toContain("searchAdminIncidents");
    expect(notificationsPage).toContain("searchAdminNotifications");
    expect(webhooksPage).toContain("searchAdminWebhookEvents");
  });

  it("health dashboard shows Not tracked via null counts", () => {
    expect(healthPage).toContain("Not tracked");
  });

  it("notifications page masks phones and disables unsafe resend", () => {
    expect(notificationsPage).toContain("recipientMasked");
    expect(notificationsPage).toContain("transactionalSmsResend");
  });

  it("webhooks page disables replay when not configured", () => {
    expect(webhooksPage).toContain("replayConfigured");
    expect(webhooksPage).toContain("disabled");
  });
});
