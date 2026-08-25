interface CustomizationCompletionOptions {
  existingWorkspace: boolean;
  save: () => Promise<boolean>;
  returnToMerchantPortal: () => void;
  continueNewStoreJourney: () => void;
}

export async function coordinateCustomizationCompletion({
  existingWorkspace,
  save,
  returnToMerchantPortal,
  continueNewStoreJourney,
}: CustomizationCompletionOptions): Promise<boolean> {
  const saved = await save();
  if (!saved) return false;

  if (existingWorkspace) returnToMerchantPortal();
  else continueNewStoreJourney();
  return true;
}
