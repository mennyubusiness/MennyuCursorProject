import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GROUP_ORDER_PARTICIPANT_ID_COOKIE,
  GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY,
  readGroupOrderParticipantMarkers,
} from "./group-order-participant-cookie";

describe("group-order-participant-cookie", () => {
  it("uses participant id cookie name distinct from legacy join token", () => {
    expect(GROUP_ORDER_PARTICIPANT_ID_COOKIE).toBe("mennyu_go_participant");
    expect(GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY).toBe("mennyu_go_join");
  });

  it("reads participant id and legacy token from cookie store", () => {
    const markers = readGroupOrderParticipantMarkers({
      get: (name: string) => {
        if (name === GROUP_ORDER_PARTICIPANT_ID_COOKIE) {
          return { value: "part_abc" };
        }
        if (name === GROUP_ORDER_JOIN_TOKEN_COOKIE_LEGACY) {
          return { value: "legacy_tok" };
        }
        return undefined;
      },
    });
    expect(markers).toEqual({
      participantId: "part_abc",
      legacyJoinToken: "legacy_tok",
    });
  });

  it("join action sets participant id cookie not joinToken in Set-Cookie", () => {
    const actionsSrc = readFileSync(
      join(process.cwd(), "src/actions/group-order.actions.ts"),
      "utf8"
    );
    expect(actionsSrc).toMatch(/setGroupOrderParticipantCookies/);
    expect(actionsSrc).not.toMatch(/store\.set\(GROUP_ORDER_JOIN_TOKEN/);
    expect(actionsSrc).toMatch(/RedirectType\.replace/);
  });

  it("cart page does not expose joinToken in source", () => {
    const pageSrc = readFileSync(join(process.cwd(), "src/app/cart/page.tsx"), "utf8");
    const withoutParam = pageSrc.replace(/joinTokenFromCookie/g, "").replace(/legacyJoinToken/g, "");
    expect(withoutParam).not.toMatch(/\bjoinToken\b/);
    expect(pageSrc).toMatch(/readGroupOrderParticipantMarkers/);
  });
});
