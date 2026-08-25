import { describe, expect, it, vi } from "vitest";
import { coordinateCustomizationCompletion } from "./customizationCompletion";

describe("coordinateCustomizationCompletion", () => {
  it("keeps the editor in place when saving fails or conflicts", async () => {
    const returnToMerchantPortal = vi.fn();
    const continueNewStoreJourney = vi.fn();

    await expect(coordinateCustomizationCompletion({
      existingWorkspace: true,
      save: vi.fn().mockResolvedValue(false),
      returnToMerchantPortal,
      continueNewStoreJourney,
    })).resolves.toBe(false);
    expect(returnToMerchantPortal).not.toHaveBeenCalled();
    expect(continueNewStoreJourney).not.toHaveBeenCalled();
  });

  it("returns an existing workspace to the merchant portal only after save", async () => {
    const returnToMerchantPortal = vi.fn();
    const continueNewStoreJourney = vi.fn();

    await coordinateCustomizationCompletion({
      existingWorkspace: true,
      save: vi.fn().mockResolvedValue(true),
      returnToMerchantPortal,
      continueNewStoreJourney,
    });
    expect(returnToMerchantPortal).toHaveBeenCalledOnce();
    expect(continueNewStoreJourney).not.toHaveBeenCalled();
  });

  it("continues a new draft to domain selection only after save", async () => {
    const returnToMerchantPortal = vi.fn();
    const continueNewStoreJourney = vi.fn();

    await coordinateCustomizationCompletion({
      existingWorkspace: false,
      save: vi.fn().mockResolvedValue(true),
      returnToMerchantPortal,
      continueNewStoreJourney,
    });
    expect(returnToMerchantPortal).not.toHaveBeenCalled();
    expect(continueNewStoreJourney).toHaveBeenCalledOnce();
  });
});
