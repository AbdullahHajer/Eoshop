import type { StoreSubmission } from "../adapters/uiAdapters";

interface MerchantLifecycleRefreshOptions {
  signal?: AbortSignal;
  listStores: (signal?: AbortSignal) => Promise<StoreSubmission[]>;
  applyStores: (stores: StoreSubmission[]) => void;
}

export async function refreshMerchantLifecycleSnapshot({
  signal,
  listStores,
  applyStores,
}: MerchantLifecycleRefreshOptions): Promise<boolean> {
  const stores = await listStores(signal);
  if (signal?.aborted) return false;
  applyStores(stores);
  return true;
}
