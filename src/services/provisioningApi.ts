import { apiMutation } from "./authApi";

export interface StoreSubmission {
  id: string;
  storeName: string;
  businessType: string;
  verificationStatus: "pending" | "approved" | "rejected" | "suspended";
  provisioningStatus: "not_started" | "queued" | "provisioning" | "retrying" | "active" | "failed";
  publicationStatus: "requested" | "published" | "unpublished" | "rejected";
  internalDomain: string | null;
  requestedDomain: string | null;
  plan: {
    key: string;
    name: string;
    activationMode: "automatic" | "manual";
  } | null;
  subscriptionStatus: "pending_activation" | "active" | "cancelled" | "expired" | null;
  publicationBlockers: string[];
  createdAt: string | null;
}

interface StoreSubmissionResponse {
  data: StoreSubmission;
  meta: { replayed: boolean };
}

export interface StoreSubmissionInput {
  storeName: string;
  businessType: string;
  themeStyle: "elegant" | "tech";
  handle: string;
  planKey: string;
  config: Record<string, unknown>;
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
  async submit(input: StoreSubmissionInput): Promise<StoreSubmissionResponse> {
    const pending = acquireIdempotencyKey(input);
    const response = await apiMutation<StoreSubmissionResponse>("/api/register-store", "POST", {
      storeName: input.storeName,
      businessType: input.businessType,
      themeStyle: input.themeStyle,
      handle: input.handle,
      planKey: input.planKey,
      config: input.config,
    }, {
      headers: { "Idempotency-Key": pending.idempotencyKey },
    });

    clearPendingSubmission(pending);

    return response;
  },
};
