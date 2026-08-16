import { apiClient } from "./apiClient";
import {
  arrayField,
  booleanField,
  enumField,
  nullableNumberField,
  numberField,
  record,
  stringArrayField,
  stringField,
} from "./apiContract";

export type PlanActivationMode = "automatic" | "manual";

export interface StorePlan {
  key: "starter" | "pro" | "business" | string;
  name: string;
  priceMinor: number | null;
  currency: string;
  billingInterval: "monthly";
  activationMode: PlanActivationMode;
  maxStores: number;
  maxProducts: number | null;
  features: string[];
}

interface PlanCollectionResponse {
  data: unknown[];
}

function mapPlan(value: unknown): StorePlan {
  const dto = record(value, "باقة المتجر");

  return {
    key: stringField(dto, "key", "باقة المتجر"),
    name: stringField(dto, "name", "باقة المتجر"),
    priceMinor: nullableNumberField(dto, "priceMinor", "باقة المتجر"),
    currency: stringField(dto, "currency", "باقة المتجر"),
    billingInterval: enumField(dto, "billingInterval", ["monthly"] as const, "باقة المتجر"),
    activationMode: enumField(dto, "activationMode", ["automatic", "manual"] as const, "باقة المتجر"),
    maxStores: numberField(dto, "maxStores", "باقة المتجر"),
    maxProducts: nullableNumberField(dto, "maxProducts", "باقة المتجر"),
    features: stringArrayField(dto, "features", "باقة المتجر"),
  };
}

interface DomainAvailabilityResponse {
  data: {
    handle: string;
    domain: string;
    available: boolean;
  };
}

export const plansApi = {
  async list(signal?: AbortSignal): Promise<StorePlan[]> {
    const payload = await apiClient.request<PlanCollectionResponse>("/api/plans", { signal });

    return arrayField(record(payload, "قائمة الباقات"), "data", "قائمة الباقات").map(mapPlan);
  },

  async domainAvailability(handle: string, signal?: AbortSignal): Promise<DomainAvailabilityResponse["data"]> {
    const payload = await apiClient.request<DomainAvailabilityResponse>(
      `/api/domains/availability?handle=${encodeURIComponent(handle)}`,
      { signal },
    );

    const dto = record(record(payload, "توفر النطاق").data, "توفر النطاق");
    return {
      handle: stringField(dto, "handle", "توفر النطاق"),
      domain: stringField(dto, "domain", "توفر النطاق"),
      available: booleanField(dto, "available", "توفر النطاق"),
    };
  },
};
