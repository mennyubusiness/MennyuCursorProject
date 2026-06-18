import { describe, expect, it } from "vitest";
import {
  formatPodAmenitiesForDisplay,
  MAX_POD_CUSTOM_AMENITIES,
  MAX_POD_CUSTOM_AMENITY_LENGTH,
  normalizePodAmenitiesInput,
  normalizePodCustomAmenitiesInput,
  parsePodAmenities,
  parsePodCustomAmenities,
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

describe("parsePodCustomAmenities", () => {
  it("returns empty for invalid input", () => {
    expect(parsePodCustomAmenities(null)).toEqual([]);
  });

  it("dedupes case-insensitively and strips markup", () => {
    expect(parsePodCustomAmenities(["Live music", "live music", "<i>Bar</i>"])).toEqual([
      "Live music",
      "Bar",
    ]);
  });

  it("enforces max count and length", () => {
    const many = Array.from({ length: 20 }, (_, i) => `Item ${i}`);
    expect(parsePodCustomAmenities(many)).toHaveLength(MAX_POD_CUSTOM_AMENITIES);
    expect(parsePodCustomAmenities(["x".repeat(80)])[0]).toHaveLength(MAX_POD_CUSTOM_AMENITY_LENGTH);
  });
});

describe("normalizePodCustomAmenitiesInput", () => {
  it("parses comma-separated text", () => {
    expect(normalizePodCustomAmenitiesInput("Live music, Fire pits , ,Trivia nights")).toEqual([
      "Live music",
      "Fire pits",
      "Trivia nights",
    ]);
  });

  it("removes empty values and duplicates", () => {
    expect(normalizePodCustomAmenitiesInput("Vegan, vegan, ")).toEqual(["Vegan"]);
  });
});
