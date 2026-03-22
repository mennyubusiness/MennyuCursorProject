import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDeliverectCommerceStoreMenus } from "./menu-api";

describe("pickNormalizerInputFromCommerceMenusResponse", () => {
  it("unwraps single-element menu array", () => {
    const inner = { products: [] };
    expect(pickNormalizerInputFromCommerceMenusResponse([inner])).toBe(inner);
  });

  it("unwraps menus[0] object", () => {
    const inner = { items: [] };
    expect(pickNormalizerInputFromCommerceMenusResponse({ menus: [inner] })).toBe(inner);
  });

  it("returns body unchanged when already a plain object", () => {
    const o = { products: [] };
    expect(pickNormalizerInputFromCommerceMenusResponse(o)).toBe(o);
  });
});

describe("fetchDeliverectCommerceStoreMenus", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    vi.stubEnv("DELIVERECT_API_KEY", "test-key");
  });

  it("calls Commerce menus URL with account and store (channel link) ids", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ _id: "menu1" }],
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchDeliverectCommerceStoreMenus({
      accountId: "acc-1",
      storeId: "store-channel-link-2",
    });

    expect(result.ok).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.deliverect.com/commerce/acc-1/stores/store-channel-link-2/menus");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });

  it("appends fulfillmentType when set", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchDeliverectCommerceStoreMenus({
      accountId: "a",
      storeId: "s",
      fulfillmentType: "pickup",
    });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("fulfillmentType=pickup");
  });
});
