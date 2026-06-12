import { describe, expect, it } from "vitest";
import {
  formatPodAmenitiesForDisplay,
  normalizePodAmenitiesInput,
  parsePodAmenities,
} from "./pod-amenities";

describe("parsePodAmenities", () => {
  it("returns empty for invalid input", () => {
    expect(parsePodAmenities(null)).toEqual([]);
    expect(parsePodAmenities("outdoor_seating")).toEqual([]);
  });

  it("parses known amenity ids and dedupes", () => {
    expect(parsePodAmenities(["parking", "invalid", "parking", "bar"])).toEqual(["parking", "bar"]);
  });
});

describe("normalizePodAmenitiesInput", () => {
  it("filters unknown ids", () => {
    expect(normalizePodAmenitiesInput(["events", "unknown"])).toEqual(["events"]);
  });
});

describe("formatPodAmenitiesForDisplay", () => {
  it("maps ids to labels", () => {
    expect(formatPodAmenitiesForDisplay(["parking", "bar"])).toEqual([
      { id: "parking", label: "Parking" },
      { id: "bar", label: "Bar" },
    ]);
  });
});
