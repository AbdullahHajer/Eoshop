import { apiClient, ApiError } from "./apiClient";
import { booleanField, enumField, nullableStringField, record, stringArrayField, stringField } from "./apiContract";
import { sanitizeCheckoutConfig } from "../contracts/checkoutPolicy";
import type { StoreConfig } from "../types";

export interface StoreSubmission {
  id: string;
  storeName: string;
  businessType: string;
  verificationStatus: "pending" | "approved" | "rejected" | "suspended";
  provisioningStatus: "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";
  publicationStatus: "requested" | "published" | "unpublished" | "rejected";
  reviewFeedback: string | null;
  capabilities: {
    workspaceManage: boolean;
    catalogManage: boolean;
    inventoryView: boolean;
    inventoryManage: boolean;
    ordersView: boolean;
    ordersManage: boolean;
    draftEdit: boolean;
    resubmit: boolean;
    publish: boolean;
    unpublish: boolean;
  };
  internalDomain: string | null;
  requestedDomain: string | null;
  publicDomain: string | null;
  plan: {
    key: string;
    name: string;
    activationMode: "automatic" | "manual";
  } | null;
  subscriptionStatus: "pending_activation" | "active" | "cancelled" | "expired" | null;
  publicationBlockers: string[];
  createdAt: string | null;
  activeAt: string | null;
  publishedAt: string | null;
}

interface StoreSubmissionResponse {
  data: unknown;
  meta: unknown;
}

export function mapSubmission(value: unknown): StoreSubmission {
  const dto = record(value, "طلب المتجر");
  const planValue = dto.plan;

  return {
    id: stringField(dto, "id", "طلب المتجر"),
    storeName: stringField(dto, "storeName", "طلب المتجر"),
    businessType: stringField(dto, "businessType", "طلب المتجر"),
    verificationStatus: enumField(dto, "verificationStatus", ["pending", "approved", "rejected", "suspended"] as const, "طلب المتجر"),
    provisioningStatus: enumField(dto, "provisioningStatus", ["not_started", "queued", "provisioning", "retrying", "active", "failed"] as const, "طلب المتجر"),
    publicationStatus: enumField(dto, "publicationStatus", ["requested", "published", "unpublished", "rejected"] as const, "طلب المتجر"),
    reviewFeedback: nullableStringField(dto, "reviewFeedback", "طلب المتجر"),
    capabilities: (() => {
      const capabilities = record(dto.capabilities, "صلاحيات طلب المتجر");
      return {
        workspaceManage: booleanField(capabilities, "workspaceManage", "صلاحيات طلب المتجر"),
        catalogManage: booleanField(capabilities, "catalogManage", "صلاحيات طلب المتجر"),
        inventoryView: booleanField(capabilities, "inventoryView", "صلاحيات طلب المتجر"),
        inventoryManage: booleanField(capabilities, "inventoryManage", "صلاحيات طلب المتجر"),
        ordersView: booleanField(capabilities, "ordersView", "صلاحيات طلب المتجر"),
        ordersManage: booleanField(capabilities, "ordersManage", "صلاحيات طلب المتجر"),
        draftEdit: booleanField(capabilities, "draftEdit", "صلاحيات طلب المتجر"),
        resubmit: booleanField(capabilities, "resubmit", "صلاحيات طلب المتجر"),
        publish: booleanField(capabilities, "publish", "صلاحيات طلب المتجر"),
        unpublish: booleanField(capabilities, "unpublish", "صلاحيات طلب المتجر"),
      };
    })(),
    internalDomain: nullableStringField(dto, "internalDomain", "طلب المتجر"),
    requestedDomain: nullableStringField(dto, "requestedDomain", "طلب المتجر"),
    publicDomain: nullableStringField(dto, "publicDomain", "طلب المتجر"),
    plan: planValue === null ? null : (() => {
      const plan = record(planValue, "باقة طلب المتجر");
      return {
        key: stringField(plan, "key", "باقة طلب المتجر"),
        name: stringField(plan, "name", "باقة طلب المتجر"),
        activationMode: enumField(plan, "activationMode", ["automatic", "manual"] as const, "باقة طلب المتجر"),
      };
    })(),
    subscriptionStatus: dto.subscriptionStatus === null
      ? null
      : enumField(dto, "subscriptionStatus", ["pending_activation", "active", "cancelled", "expired"] as const, "طلب المتجر"),
    publicationBlockers: stringArrayField(dto, "publicationBlockers", "طلب المتجر"),
    createdAt: nullableStringField(dto, "createdAt", "طلب المتجر"),
    activeAt: nullableStringField(dto, "activeAt", "طلب المتجر"),
    publishedAt: nullableStringField(dto, "publishedAt", "طلب المتجر"),
  };
}

export interface StoreSubmissionInput {
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string;
  planKey: string;
  config: Record<string, unknown>;
  draftId?: string;
  expectedDraftRevision?: number;
}

export interface StoreDraft {
  id: string;
  tenantId: string | null;
  status: "draft" | "submitted" | "correction_required";
  revision: number;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string | null;
  planKey: string | null;
  config: StoreConfig;
  savedAt: string | null;
  submittedAt: string | null;
}

export interface StoreDraftInput {
  expectedRevision: number;
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string | null;
  planKey: string | null;
  config: Record<string, unknown>;
}

function numberField(dto: Record<string, unknown>, key: string, context: string): number {
  const value = dto[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new ApiError(`استجابة ${context} لا تحتوي ${key} صالحًا.`, "unexpected", 200);
  }
  return value;
}

function mapDraft(value: unknown): StoreDraft {
  const dto = record(value, "مسودة المتجر");
  return {
    id: stringField(dto, "id", "مسودة المتجر"),
    tenantId: nullableStringField(dto, "tenantId", "مسودة المتجر"),
    status: enumField(dto, "status", ["draft", "submitted", "correction_required"] as const, "مسودة المتجر"),
    revision: numberField(dto, "revision", "مسودة المتجر"),
    storeName: stringField(dto, "storeName", "مسودة المتجر"),
    businessType: stringField(dto, "businessType", "مسودة المتجر"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "مسودة المتجر"),
    handle: nullableStringField(dto, "handle", "مسودة المتجر"),
    planKey: nullableStringField(dto, "planKey", "مسودة المتجر"),
    config: sanitizeCheckoutConfig(record(dto.config, "إعدادات مسودة المتجر") as unknown as StoreConfig),
    savedAt: nullableStringField(dto, "savedAt", "مسودة المتجر"),
    submittedAt: nullableStringField(dto, "submittedAt", "مسودة المتجر"),
  };
}

interface PendingSubmission {
  fingerprint: string;
  idempotencyKey: string;
}

const pendingStorageKey = "eoshop.pending-store-submission.v1";
let volatilePending: PendingSubmission | null = null;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]));
  }
  return value;
}

function fingerprint(input: StoreSubmissionInput): string {
  return JSON.stringify(canonicalize(input));
}

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function acquireIdempotencyKey(input: StoreSubmissionInput): PendingSubmission {
  const requestFingerprint = fingerprint(input);
  const persistentStorage = storage();
  let pending = volatilePending;

  if (persistentStorage) {
    try {
      pending = JSON.parse(persistentStorage.getItem(pendingStorageKey) || "null") as PendingSubmission | null;
    } catch {
      pending = null;
    }
  }

  if (!pending || pending.fingerprint !== requestFingerprint) {
    pending = { fingerprint: requestFingerprint, idempotencyKey: crypto.randomUUID() };
  }

  volatilePending = pending;
  persistentStorage?.setItem(pendingStorageKey, JSON.stringify(pending));

  return pending;
}

function clearPendingSubmission(pending: PendingSubmission): void {
  if (volatilePending?.idempotencyKey === pending.idempotencyKey) volatilePending = null;
  const persistentStorage = storage();
  if (!persistentStorage) return;

  try {
    const stored = JSON.parse(persistentStorage.getItem(pendingStorageKey) || "null") as PendingSubmission | null;
    if (stored?.idempotencyKey === pending.idempotencyKey) persistentStorage.removeItem(pendingStorageKey);
  } catch {
    persistentStorage.removeItem(pendingStorageKey);
  }
}

export const provisioningApi = {
  async currentDraft(signal?: AbortSignal): Promise<StoreDraft | null> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft", { signal });
    const envelope = record(response, "استجابة المسودة الحالية");
    return envelope.data === null ? null : mapDraft(envelope.data);
  },

  async correctionDraft(tenantId: string, signal?: AbortSignal): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/draft`, { signal });
    return mapDraft(record(response, "استجابة مسودة التصحيح").data);
  },

  async saveDraft(input: StoreDraftInput): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/store-draft", {
      method: "PUT",
      body: input,
    });
    return mapDraft(record(response, "استجابة حفظ المسودة").data);
  },

  async saveCorrection(tenantId: string, input: StoreDraftInput): Promise<StoreDraft> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/draft`, {
      method: "PATCH",
      body: input,
    });
    return mapDraft(record(response, "استجابة حفظ التصحيح").data);
  },

  async listStores(): Promise<StoreSubmission[]> {
    const response = await apiClient.request<{ data: unknown }>("/api/merchant/stores");
    const envelope = record(response, "قائمة متاجر التاجر");
    const data = envelope.data;
    if (!Array.isArray(data)) throw new ApiError("استجابة الخادم لا تطابق عقد قائمة متاجر التاجر.", "unexpected", 200);

    return data.map(mapSubmission);
  },

  async submit(input: StoreSubmissionInput): Promise<{ data: StoreSubmission; meta: { replayed: boolean } }> {
    const pending = acquireIdempotencyKey(input);
    const response = await apiClient.request<StoreSubmissionResponse>("/api/register-store", {
      method: "POST",
      body: {
        storeName: input.storeName,
        businessType: input.businessType,
        themeStyle: input.themeStyle,
        handle: input.handle,
        planKey: input.planKey,
        config: input.config,
        draftId: input.draftId,
        expectedDraftRevision: input.expectedDraftRevision,
      },
      headers: { "Idempotency-Key": pending.idempotencyKey },
      retrySafety: "idempotent",
    });

    clearPendingSubmission(pending);

    const envelope = record(response, "استجابة طلب المتجر");
    const meta = record(envelope.meta, "بيانات تكرار طلب المتجر");
    return { data: mapSubmission(envelope.data), meta: { replayed: booleanField(meta, "replayed", "بيانات تكرار طلب المتجر") } };
  },

  async resubmit(tenantId: string, expectedRevision: number): Promise<{ data: StoreSubmission; meta: { replayed: boolean } }> {
    const storageKey = `eoshop.pending-store-resubmission.v1:${tenantId}`;
    let idempotencyKey: string = crypto.randomUUID();
    try {
      const pending = JSON.parse(localStorage.getItem(storageKey) || "null") as { revision?: number; key?: string } | null;
      if (pending?.revision === expectedRevision && typeof pending.key === "string") idempotencyKey = pending.key;
      localStorage.setItem(storageKey, JSON.stringify({ revision: expectedRevision, key: idempotencyKey }));
    } catch {
      // Browser recovery is optional; the server remains authoritative.
    }
    const response = await apiClient.request<StoreSubmissionResponse>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/resubmit`, {
      method: "POST",
      body: { expectedRevision },
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
    });
    try { localStorage.removeItem(storageKey); } catch { /* optional recovery */ }
    const envelope = record(response, "استجابة إعادة إرسال المتجر");
    const meta = record(envelope.meta, "بيانات تكرار إعادة الإرسال");
    return { data: mapSubmission(envelope.data), meta: { replayed: booleanField(meta, "replayed", "بيانات تكرار إعادة الإرسال") } };
  },

  async publish(tenantId: string): Promise<StoreSubmission> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/publication/publish`, { method: "POST" });
    return mapSubmission(record(response, "استجابة نشر المتجر").data);
  },

  async unpublish(tenantId: string): Promise<StoreSubmission> {
    const response = await apiClient.request<{ data: unknown }>(`/api/merchant/stores/${encodeURIComponent(tenantId)}/publication/unpublish`, { method: "POST" });
    return mapSubmission(record(response, "استجابة إلغاء نشر المتجر").data);
  },
};
