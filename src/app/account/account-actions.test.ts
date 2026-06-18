import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSignOut = vi.fn();
const mockAuth = vi.fn();
const mockUserUpdate = vi.fn();
const mockRevalidatePath = vi.fn();
const mockRotateSession = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

vi.mock("@/auth", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/session-request", () => ({
  rotateMennyuSessionForSignOut: (...args: unknown[]) => mockRotateSession(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}));

import { signOutAccountAction, updateAccountNameAction } from "./actions";
import { SIGN_IN_PATH } from "@/lib/auth/account-paths";

function formWithReturnPath(returnPath: string | null): FormData {
  const formData = new FormData();
  if (returnPath != null) {
    formData.set("returnPath", returnPath);
  }
  return formData;
}

describe("signOutAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRotateSession.mockResolvedValue("sess_new");
  });

  it("rotates mennyu session and keeps account cart in DB", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await signOutAccountAction(formWithReturnPath("/pod/abc"));
    expect(mockRotateSession).toHaveBeenCalled();
    expect(mockRevalidatePath).toHaveBeenCalledWith("/", "layout");
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: "/pod/abc" });
  });

  it("redirects to sign-in from protected pages", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await signOutAccountAction(formWithReturnPath("/account"));
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: SIGN_IN_PATH });
  });

  it("redirects to sign-in when return path is missing", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await signOutAccountAction(new FormData());
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: SIGN_IN_PATH });
  });
});

describe("updateAccountNameAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user_1" } });
    mockUserUpdate.mockResolvedValue({});
  });

  it("updates user name when signed in", async () => {
    const result = await updateAccountNameAction("Sam Customer");
    expect(result).toEqual({ ok: true });
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { name: "Sam Customer" },
    });
  });

  it("rejects when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const result = await updateAccountNameAction("Sam");
    expect(result.ok).toBe(false);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
