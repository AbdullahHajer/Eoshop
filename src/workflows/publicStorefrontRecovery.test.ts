// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { UiAdapterError } from "../contracts/uiError";
import { loadPublicStorefrontWithRecovery, publicStorefrontFailureMessage } from "./publicStorefrontRecovery";

describe("public storefront recovery", () => {
  it("retries one transient read and returns the recovered storefront", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("offline", "network"))
      .mockResolvedValueOnce({ storeName: "Recovered store" });

    await expect(loadPublicStorefrontWithRecovery(loader, new AbortController().signal, 0))
      .resolves.toEqual({ storeName: "Recovered store" });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("does not retry a missing public domain", async () => {
    const loader = vi.fn().mockRejectedValue(new UiAdapterError("missing", "not_found"));

    await expect(loadPublicStorefrontWithRecovery(loader, new AbortController().signal, 0))
      .rejects.toMatchObject({ category: "not_found" });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("cancels the delayed retry when the owning route is aborted", async () => {
    const controller = new AbortController();
    const loader = vi.fn().mockRejectedValue(new UiAdapterError("offline", "server"));
    const request = loadPublicStorefrontWithRecovery(loader, controller.signal, 10_000);

    controller.abort(new DOMException("aborted", "AbortError"));

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("uses distinct safe messages for missing, network and service failures", () => {
    expect(publicStorefrontFailureMessage(new UiAdapterError("hidden", "not_found"))).toContain("لا يوجد متجر منشور");
    expect(publicStorefrontFailureMessage(new UiAdapterError("hidden", "network"))).toContain("الاتصال");
    expect(publicStorefrontFailureMessage(new UiAdapterError("hidden", "server"))).toContain("غير متاحة مؤقتًا");
  });
});
