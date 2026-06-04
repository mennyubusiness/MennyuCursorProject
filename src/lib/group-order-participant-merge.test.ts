import { describe, expect, it } from "vitest";
import {
  duplicateParticipantIdsToRemove,
  pickKeeperParticipantId,
  type ParticipantMergeCandidate,
} from "./group-order-participant-merge";

function row(
  partial: Partial<ParticipantMergeCandidate> & Pick<ParticipantMergeCandidate, "id">
): ParticipantMergeCandidate {
  return {
    createdAt: new Date("2026-06-01T12:00:00Z"),
    leftAt: null,
    displayName: "Guest",
    cartItemCount: 0,
    orderLineItemCount: 0,
    ...partial,
  };
}

describe("pickKeeperParticipantId", () => {
  it("keeps participant with more cart lines", () => {
    const keeper = pickKeeperParticipantId([
      row({ id: "p_early", createdAt: new Date("2026-06-01T10:00:00Z") }),
      row({ id: "p_lines", cartItemCount: 3 }),
    ]);
    expect(keeper).toBe("p_lines");
  });

  it("prefers active participant over left when line counts tie", () => {
    const keeper = pickKeeperParticipantId([
      row({ id: "p_left", leftAt: new Date("2026-06-02") }),
      row({ id: "p_active", createdAt: new Date("2026-06-03") }),
    ]);
    expect(keeper).toBe("p_active");
  });

  it("keeps earliest when line counts and active status tie", () => {
    const keeper = pickKeeperParticipantId([
      row({ id: "p_first", createdAt: new Date("2026-06-01T10:00:00Z") }),
      row({ id: "p_second", createdAt: new Date("2026-06-01T11:00:00Z") }),
    ]);
    expect(keeper).toBe("p_first");
  });
});

describe("duplicateParticipantIdsToRemove", () => {
  it("lists non-keeper ids", () => {
    const candidates = [
      row({ id: "keep", cartItemCount: 2 }),
      row({ id: "drop" }),
    ];
    expect(duplicateParticipantIdsToRemove(candidates, "keep")).toEqual(["drop"]);
  });
});
