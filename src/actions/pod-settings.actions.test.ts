import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/permissions", () => ({
  canAccessPodDashboardLayout: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from "next/cache";

vi.mock("@/lib/db", () => ({
  prisma: {
    pod: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { canAccessPodDashboardLayout } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { updatePodAnnouncement } from "@/actions/pod-settings.actions";
import { POD_ANNOUNCEMENT_MAX_LENGTH } from "@/lib/pod-announcement";

describe("updatePodAnnouncement", () => {
  beforeEach(() => {
    vi.mocked(canAccessPodDashboardLayout).mockReset();
    vi.mocked(prisma.pod.findUnique).mockReset();
    vi.mocked(prisma.pod.update).mockReset();
  });

  it("requires pod dashboard permission", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(false);

    const res = await updatePodAnnouncement("pod_1", {
      text: "Live music Friday",
      isActive: true,
    });

    expect(res).toEqual({ ok: false, error: "Unauthorized." });
    expect(prisma.pod.update).not.toHaveBeenCalled();
  });

  it("enforces max length server-side", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });

    const res = await updatePodAnnouncement("pod_1", {
      text: "a".repeat(POD_ANNOUNCEMENT_MAX_LENGTH + 1),
      isActive: true,
    });

    expect(res.ok).toBe(false);
    expect(prisma.pod.update).not.toHaveBeenCalled();
  });

  it("clears and deactivates empty announcements", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    const res = await updatePodAnnouncement("pod_1", { text: "   ", isActive: true });

    expect(res).toEqual({ ok: true });
    expect(prisma.pod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pod_1" },
        data: expect.objectContaining({
          announcementText: null,
          announcementIsActive: false,
        }),
      })
    );
  });

  it("saves active announcement text", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    const res = await updatePodAnnouncement("pod_1", {
      text: "  New cart now open  ",
      isActive: true,
    });

    expect(res).toEqual({ ok: true });
    expect(prisma.pod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementText: "New cart now open",
          announcementIsActive: true,
        }),
      })
    );
  });

  it("keeps saved text inactive when toggle is off", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    await updatePodAnnouncement("pod_1", {
      text: "Holiday hours updated",
      isActive: false,
    });

    expect(prisma.pod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementText: "Holiday hours updated",
          announcementIsActive: false,
        }),
      })
    );
  });

  it("strips control characters before save", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    await updatePodAnnouncement("pod_1", {
      text: "Live music\u0007Friday",
      isActive: true,
    });

    expect(prisma.pod.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          announcementText: "Live musicFriday",
          announcementIsActive: true,
        }),
      })
    );
  });

  it("can clear an already-empty announcement repeatedly", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    const first = await updatePodAnnouncement("pod_1", { text: "", isActive: false });
    const second = await updatePodAnnouncement("pod_1", { text: "   ", isActive: true });

    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });
    expect(prisma.pod.update).toHaveBeenCalledTimes(2);
  });

  it("revalidates dashboard and public pod page paths", async () => {
    vi.mocked(canAccessPodDashboardLayout).mockResolvedValue(true);
    vi.mocked(prisma.pod.findUnique).mockResolvedValue({ id: "pod_1", slug: "riverside" });
    vi.mocked(prisma.pod.update).mockResolvedValue({} as never);

    await updatePodAnnouncement("pod_1", { text: "New cart now open", isActive: true });

    expect(revalidatePath).toHaveBeenCalledWith("/pod/pod_1/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/riverside");
    expect(revalidatePath).toHaveBeenCalledWith("/pod/pod_1/settings");
  });
});
