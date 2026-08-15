import { apiGet } from "./authApi";

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
  data: StorePlan[];
}

interface DomainAvailabilityResponse {
  data: {
    handle: string;
    domain: string;
    available: boolean;
  };
}

export const plansApi = {
  async list(): Promise<StorePlan[]> {
    const payload = await apiGet<PlanCollectionResponse>("/api/plans");

    return payload.data;
  },

  async domainAvailability(handle: string): Promise<DomainAvailabilityResponse["data"]> {
    const payload = await apiGet<DomainAvailabilityResponse>(
      `/api/domains/availability?handle=${encodeURIComponent(handle)}`,
    );

    return payload.data;
  },
};
