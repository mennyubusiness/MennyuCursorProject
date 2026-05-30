import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSignOut = vi.fn();

vi.mock("@/auth", () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

import { signOutAccountAction } from "./actions";
import { SIGN_IN_PATH } from "@/lib/auth/account-paths";

describe("signOutAccountAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls Auth.js signOut with login redirect", async () => {
    mockSignOut.mockResolvedValue(undefined);
    await signOutAccountAction();
    expect(mockSignOut).toHaveBeenCalledWith({ redirectTo: SIGN_IN_PATH });
  });
});
