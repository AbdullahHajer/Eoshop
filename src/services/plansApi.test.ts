import { afterEach, describe, expect, it, vi } from "vitest";
import { plansApi } from "./plansApi";
import { apiClient } from "./apiClient";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("plansApi", () => {
  it("loads server-owned plans and checks an encoded handle", async () => {
    const plans = [{
      key: "starter",
      name: "Starter",
      priceMinor: 0,
      currency: "SAR",
      billingInterval: "monthly",
      activationMode: "automatic",
      maxStores: 1,
      maxProducts: 10,
      features: ["platform_subdomain"],
    }];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: plans }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: { handle: "my-shop", domain: "my-shop.eoshop.local", available: true },
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(plansApi.list()).resolves.toEqual(plans);
    await expect(plansApi.domainAvailability("my shop")).resolves.toMatchObject({ available: true });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/domains/availability?handle=my%20shop",
      expect.objectContaining({ credentials: "same-origin" }),
    );
  });
});
