import { apiGet, apiMutation } from "./authApi";

export type VerificationStatus = "approved" | "pending" | "rejected" | "suspended";

export interface PlatformStore {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  businessType: string;
  verificationStatus: VerificationStatus;
  rejectionReason: string | null;
  themeStyle: "elegant" | "tech";
  domains: string[];
  createdAt: string | null;
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
};
