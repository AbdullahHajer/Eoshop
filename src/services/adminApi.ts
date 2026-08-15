import { apiGet, apiMutation } from "./authApi";

export type VerificationStatus = "approved" | "pending" | "rejected" | "suspended";
export type ProvisioningStatus = "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";

export interface PlatformStore {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  businessType: string;
  verificationStatus: VerificationStatus;
  provisioningStatus: ProvisioningStatus;
  rejectionReason: string | null;
  themeStyle: "elegant" | "tech";
  domains: string[];
  createdAt: string | null;
  activeAt: string | null;
  latestProvisioningRun: {
    id: string;
    status: ProvisioningStatus;
    runNumber: number;
    lastCompletedStep: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  } | null;
}

interface StoreCollectionResponse {
  data: PlatformStore[];
}

interface StoreResponse {
  data: PlatformStore;
  meta: { requestId: string };
}

export const adminApi = {
  async listStores(): Promise<PlatformStore[]> {
    const payload = await apiGet<StoreCollectionResponse>("/api/admin/stores");

    return payload.data;
  },

  async updateStoreStatus(
    storeId: string,
    status: VerificationStatus,
    reason?: string,
  ): Promise<PlatformStore> {
    const payload = await apiMutation<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/status`,
      "PATCH",
      { status, reason: reason || null },
    );

    return payload.data;
  },

  async retryProvisioning(storeId: string): Promise<PlatformStore> {
    const payload = await apiMutation<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/provisioning/retry`,
      "POST",
      {},
    );

    return payload.data;
  },
};
