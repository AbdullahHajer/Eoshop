import { apiClient, ApiError } from "./apiClient";
import type {
  ConfigureBasGateConnectionInput,
  PaymentConnection,
} from "../contracts/paymentConnection";
import {
  booleanField,
  enumField,
  nullableStringField,
  numberField,
  record,
  stringField,
} from "./apiContract";

const environments = ["sandbox", "production"] as const;
const states = ["unconfigured", "draft", "verification_pending", "active", "verification_failed", "disabled"] as const;

function invalid(contract: string): never {
  throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
}

function mapTimestamp(value: string | null, contract: string): string | null {
  if (value === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) || Number.isNaN(Date.parse(value))) {
    return invalid(contract);
  }
  return value;
}

export function mapPaymentConnection(value: unknown): PaymentConnection {
  const envelope = record(value, "اتصال بوابة الدفع");
  const dto = record(envelope.data, "اتصال بوابة الدفع");
  const provider = stringField(dto, "provider", "اتصال بوابة الدفع");
  if (provider !== "basgate") return invalid("اتصال بوابة الدفع");

  const state = enumField(dto, "state", states, "اتصال بوابة الدفع");
  const revision = numberField(dto, "revision", "اتصال بوابة الدفع");
  if (!Number.isSafeInteger(revision) || revision < 0) return invalid("اتصال بوابة الدفع");

  const environment = dto.environment === null
    ? null
    : enumField(dto, "environment", environments, "اتصال بوابة الدفع");
  if (
    (state === "unconfigured" && (environment !== null || revision !== 0))
    || (state !== "unconfigured" && (environment === null || revision < 1))
  ) {
    return invalid("اتصال بوابة الدفع");
  }

  const canAcceptOnlinePayments = booleanField(dto, "canAcceptOnlinePayments", "اتصال بوابة الدفع");
  if (canAcceptOnlinePayments && state !== "active") return invalid("اتصال بوابة الدفع");

  return {
    provider: "basgate",
    environment,
    state,
    revision,
    canAcceptOnlinePayments,
    lastVerificationCode: nullableStringField(dto, "lastVerificationCode", "اتصال بوابة الدفع"),
    lastVerifiedAt: mapTimestamp(nullableStringField(dto, "lastVerifiedAt", "اتصال بوابة الدفع"), "تاريخ آخر تحقق من اتصال الدفع"),
    updatedAt: mapTimestamp(nullableStringField(dto, "updatedAt", "اتصال بوابة الدفع"), "تاريخ تحديث اتصال الدفع"),
  };
}

function path(tenantId: string): string {
  return `/api/merchant/stores/${encodeURIComponent(tenantId)}/payment-connections/basgate`;
}

export const paymentConnectionApi = {
  async load(tenantId: string, signal?: AbortSignal): Promise<PaymentConnection> {
    return mapPaymentConnection(await apiClient.request(path(tenantId), { signal }));
  },

  async configure(
    tenantId: string,
    input: ConfigureBasGateConnectionInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<PaymentConnection> {
    return mapPaymentConnection(await apiClient.request(path(tenantId), {
      method: "PUT",
      body: input,
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
      signal,
    }));
  },
};
