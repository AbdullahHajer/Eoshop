import { apiClient } from "./apiClient";
import {
  arrayField,
  enumField,
  nullableStringField,
  numberField,
  record,
  stringArrayField,
  stringField,
} from "./apiContract";

export type VerificationStatus = "approved" | "pending" | "rejected" | "suspended";
export type ProvisioningStatus = "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";
export type PublicationStatus = "requested" | "published" | "unpublished" | "rejected";

export interface PlatformStore {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  businessType: string;
  verificationStatus: VerificationStatus;
  provisioningStatus: ProvisioningStatus;
  publicationStatus: PublicationStatus;
  rejectionReason: string | null;
  themeStyle: "elegant" | "tech";
  domains: string[];
  requestedDomain: string | null;
  publicDomain: string | null;
  publicationBlockers: string[];
  subscription: {
    id: string;
    status: "pending_activation" | "active" | "cancelled" | "expired";
    endsAt: string | null;
    plan: {
      key: string;
      name: string;
      activationMode: "automatic" | "manual";
    };
  } | null;
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
  data: unknown[];
}

interface StoreResponse {
  data: unknown;
  meta: { requestId: string };
}

function mapStore(value: unknown): PlatformStore {
  const dto = record(value, "متجر المنصة");
  const subscriptionValue = dto.subscription;
  const runValue = dto.latestProvisioningRun;

  return {
    id: stringField(dto, "id", "متجر المنصة"),
    storeName: stringField(dto, "storeName", "متجر المنصة"),
    ownerName: stringField(dto, "ownerName", "متجر المنصة"),
    ownerEmail: stringField(dto, "ownerEmail", "متجر المنصة"),
    ownerPhone: nullableStringField(dto, "ownerPhone", "متجر المنصة"),
    businessType: stringField(dto, "businessType", "متجر المنصة"),
    verificationStatus: enumField(dto, "verificationStatus", ["approved", "pending", "rejected", "suspended"] as const, "متجر المنصة"),
    provisioningStatus: enumField(dto, "provisioningStatus", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "متجر المنصة"),
    publicationStatus: enumField(dto, "publicationStatus", ["requested", "published", "unpublished", "rejected"] as const, "متجر المنصة"),
    rejectionReason: nullableStringField(dto, "rejectionReason", "متجر المنصة"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "متجر المنصة"),
    domains: stringArrayField(dto, "domains", "متجر المنصة"),
    requestedDomain: nullableStringField(dto, "requestedDomain", "متجر المنصة"),
    publicDomain: nullableStringField(dto, "publicDomain", "متجر المنصة"),
    publicationBlockers: stringArrayField(dto, "publicationBlockers", "متجر المنصة"),
    subscription: subscriptionValue === null ? null : (() => {
      const subscription = record(subscriptionValue, "اشتراك المتجر");
      const plan = record(subscription.plan, "باقة الاشتراك");
      return {
        id: stringField(subscription, "id", "اشتراك المتجر"),
        status: enumField(subscription, "status", ["pending_activation", "active", "cancelled", "expired"] as const, "اشتراك المتجر"),
        endsAt: nullableStringField(subscription, "endsAt", "اشتراك المتجر"),
        plan: {
          key: stringField(plan, "key", "باقة الاشتراك"),
          name: stringField(plan, "name", "باقة الاشتراك"),
          activationMode: enumField(plan, "activationMode", ["automatic", "manual"] as const, "باقة الاشتراك"),
        },
      };
    })(),
    createdAt: nullableStringField(dto, "createdAt", "متجر المنصة"),
    activeAt: nullableStringField(dto, "activeAt", "متجر المنصة"),
    latestProvisioningRun: runValue === null ? null : (() => {
      const run = record(runValue, "تشغيل تجهيز المتجر");
      return {
        id: stringField(run, "id", "تشغيل تجهيز المتجر"),
        status: enumField(run, "status", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "تشغيل تجهيز المتجر"),
        runNumber: numberField(run, "runNumber", "تشغيل تجهيز المتجر"),
        lastCompletedStep: nullableStringField(run, "lastCompletedStep", "تشغيل تجهيز المتجر"),
        lastErrorCode: nullableStringField(run, "lastErrorCode", "تشغيل تجهيز المتجر"),
        lastErrorMessage: nullableStringField(run, "lastErrorMessage", "تشغيل تجهيز المتجر"),
      };
    })(),
  };
}

export const adminApi = {
  async listStores(): Promise<PlatformStore[]> {
    const payload = await apiClient.request<StoreCollectionResponse>("/api/admin/stores");

    return arrayField(record(payload, "قائمة متاجر المنصة"), "data", "قائمة متاجر المنصة").map(mapStore);
  },

  async updateStoreStatus(
    storeId: string,
    status: VerificationStatus,
    reason?: string,
  ): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/status`, {
        method: "PATCH",
        body: { status, reason: reason || null },
      });

    return mapStore(record(payload, "تحديث حالة المتجر").data);
  },

  async retryProvisioning(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/provisioning/retry`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "إعادة تجهيز المتجر").data);
  },

  async activateSubscription(storeId: string, endsAt: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/subscription/activate`, {
        method: "POST",
        body: { endsAt },
      });

    return mapStore(record(payload, "تفعيل اشتراك المتجر").data);
  },

  async publish(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/publication/publish`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "نشر المتجر").data);
  },

  async unpublish(storeId: string): Promise<PlatformStore> {
    const payload = await apiClient.request<StoreResponse>(
      `/api/admin/stores/${encodeURIComponent(storeId)}/publication/unpublish`, {
        method: "POST",
        body: {},
      });

    return mapStore(record(payload, "إيقاف نشر المتجر").data);
  },
};
