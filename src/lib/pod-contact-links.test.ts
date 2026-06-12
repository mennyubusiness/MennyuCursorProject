import { describe, expect, it } from "vitest";
import { buildDirectionsUrl } from "./pod-contact-links";

describe("buildDirectionsUrl", () => {
  it("builds a Google Maps directions search URL", () => {
    expect(buildDirectionsUrl("123 Main St, Austin, TX")).toBe(
      "https://www.google.com/maps/search/?api=1&query=123%20Main%20St%2C%20Austin%2C%20TX"
    );
  });
});
