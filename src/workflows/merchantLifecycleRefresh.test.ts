import { describe, expect, it, vi } from "vitest";
import type { StoreSubmission } from "../adapters/uiAdapters";
import { refreshMerchantLifecycleSnapshot } from "./merchantLifecycleRefresh";

const stores = [] as StoreSubmission[];

describe("refreshMerchantLifecycleSnapshot", () => {
  it("applies only the narrow store lifecycle snapshot", async () => {
    const applyStores = vi.fn();
    await expect(refreshMerchantLifecycleSnapshot({
      listStores: vi.fn().mockResolvedValue(stores),
      applyStores,
    })).resolves.toBe(true);
    expect(applyStores).toHaveBeenCalledWith(stores);
  });

  it("does not apply a late result after route cancellation", async () => {
    const controller = new AbortController();
    let resolveStores!: (value: StoreSubmission[]) => void;
    const listStores = vi.fn(() => new Promise<StoreSubmission[]>((resolve) => { resolveStores = resolve; }));
    const applyStores = vi.fn();

    const refresh = refreshMerchantLifecycleSnapshot({
      signal: controller.signal,
      listStores,
      applyStores,
    });
    controller.abort();
    resolveStores(stores);

    await expect(refresh).resolves.toBe(false);
    expect(applyStores).not.toHaveBeenCalled();
  });
});
