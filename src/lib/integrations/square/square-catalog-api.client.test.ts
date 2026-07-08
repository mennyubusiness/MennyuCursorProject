import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SquareCatalogObject } from "@/lib/integrations/square/square-catalog.types";

vi.mock("@/lib/integrations/square/square-config", () => ({
  resolveSquareEnvironment: vi.fn(() => "sandbox"),
  getSquareApiBaseUrl: vi.fn(() => "https://connect.squareupsandbox.com"),
}));

import {
  fetchSquareCatalogForLocation,
  fetchSquareCatalogObjects,
  isSquareCatalogObjectAvailableAtLocation,
} from "@/lib/integrations/square/square-api.client";

describe("square catalog api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("paginates catalog list requests and uses vendor access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: [{ type: "CATEGORY", id: "cat_1" }],
          cursor: "page_2",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          objects: [{ type: "ITEM", id: "item_1" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const objects = await fetchSquareCatalogObjects("vendor_oauth_token_abc");
    expect(objects).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/v2/catalog/list?");
    expect(fetchMock.mock.calls[0]?.[1]?.headers?.Authorization).toBe(
      "Bearer vendor_oauth_token_abc"
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain("cursor=page_2");
  });

  it("filters catalog objects to selected location", async () => {
    const allObjects: SquareCatalogObject[] = [
      { type: "ITEM", id: "item_all", present_at_all_locations: true },
      {
        type: "ITEM",
        id: "item_loc",
        present_at_location_ids: ["LOC_A"],
      },
      {
        type: "ITEM",
        id: "item_absent",
        present_at_all_locations: true,
        absent_at_location_ids: ["LOC_A"],
      },
      { type: "ITEM", id: "item_deleted", is_deleted: true, present_at_all_locations: true },
    ];

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ objects: allObjects }),
      })
    );

    const filtered = await fetchSquareCatalogForLocation("token", "LOC_A");
    expect(filtered.map((o) => o.id)).toEqual(["item_all", "item_loc"]);
  });

  it("location availability helper respects present/absent flags", () => {
    const obj: SquareCatalogObject = {
      type: "ITEM",
      id: "x",
      present_at_all_locations: true,
      absent_at_location_ids: ["LOC_B"],
    };
    expect(isSquareCatalogObjectAvailableAtLocation(obj, "LOC_A")).toBe(true);
    expect(isSquareCatalogObjectAvailableAtLocation(obj, "LOC_B")).toBe(false);
    expect(
      isSquareCatalogObjectAvailableAtLocation(
        { type: "ITEM", id: "y", present_at_location_ids: ["LOC_A"] },
        "LOC_A"
      )
    ).toBe(true);
    expect(
      isSquareCatalogObjectAvailableAtLocation(
        { type: "ITEM", id: "z", is_deleted: true, present_at_all_locations: true },
        "LOC_A"
      )
    ).toBe(false);
  });
});
