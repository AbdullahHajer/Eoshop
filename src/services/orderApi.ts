import type { StoreConfig } from "../types";
import { apiClient, ApiError } from "./apiClient";
import { arrayField, enumField, numberField, record, stringField } from "./apiContract";
import { mapStoreConfig } from "./workspaceApi";

export interface StorefrontBootstrap {
  workspaceRevision: number;
  catalogRevision: number;
  config: StoreConfig;
}

export interface OrderReceipt {
  id: string;
  number: string;
  status: "submitted" | "accepted" | "processing" | "completed" | "cancelled" | "expired";
  paymentState: "due_on_delivery" | "transfer_submitted_unverified";
  currencyCode: string;
  totals: {
    itemsSubtotalMinor: number;
    discountMinor: number;
    shippingMinor: number;
    taxMinor: number;
    paymentFeeMinor: number;
    grandTotalMinor: number;
  };
  createdAt: string;
  items?: Array<{
    productId: string;
    name: string;
    sku: string;
    unitPriceMinor: number;
    quantity: number;
    lineTotalMinor: number;
    tracked: boolean;
  }>;
}

export interface CreateOrderInput {
  workspaceRevision: number;
  catalogRevision: number;
  lines: Array<{ productId: string; quantity: number }>;
  couponCode?: string;
  payment: { method: "cod" | "bank_transfer" | "wallet"; channelId?: string; reference?: string };
  customer: { name: string; phone: string; email?: string; notes?: string };
  address: { city: string; area: string; street?: string; details?: string };
}

function invalid(contract: string): never {
  throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
}

function nonNegativeIntegerField(source: Record<string, unknown>, key: string, contract: string): number {
  const value = numberField(source, key, contract);
  if (!Number.isSafeInteger(value) || value < 0) return invalid(contract);
  return value;
}

function mapReceipt(value: unknown): OrderReceipt {
  const dto = record(value, "إيصال الطلب");
  const totals = record(dto.totals, "إجماليات الطلب");
  const receipt: OrderReceipt = {
    id: stringField(dto, "id", "إيصال الطلب"),
    number: stringField(dto, "number", "إيصال الطلب"),
    status: enumField(dto, "status", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "إيصال الطلب"),
    paymentState: enumField(dto, "paymentState", ["due_on_delivery", "transfer_submitted_unverified"] as const, "إيصال الطلب"),
    currencyCode: stringField(dto, "currencyCode", "إيصال الطلب"),
    totals: {
      itemsSubtotalMinor: nonNegativeIntegerField(totals, "itemsSubtotalMinor", "إجماليات الطلب"),
      discountMinor: nonNegativeIntegerField(totals, "discountMinor", "إجماليات الطلب"),
      shippingMinor: nonNegativeIntegerField(totals, "shippingMinor", "إجماليات الطلب"),
      taxMinor: nonNegativeIntegerField(totals, "taxMinor", "إجماليات الطلب"),
      paymentFeeMinor: nonNegativeIntegerField(totals, "paymentFeeMinor", "إجماليات الطلب"),
      grandTotalMinor: nonNegativeIntegerField(totals, "grandTotalMinor", "إجماليات الطلب"),
    },
    createdAt: stringField(dto, "createdAt", "إيصال الطلب"),
  };
  if (dto.items !== undefined) {
    receipt.items = arrayField(dto, "items", "بنود الطلب").map((value) => {
      const item = record(value, "بند الطلب");
      if (typeof item.tracked !== "boolean") return invalid("بند الطلب");
      return {
        productId: stringField(item, "productId", "بند الطلب"),
        name: stringField(item, "name", "بند الطلب"),
        sku: stringField(item, "sku", "بند الطلب"),
        unitPriceMinor: nonNegativeIntegerField(item, "unitPriceMinor", "بند الطلب"),
        quantity: nonNegativeIntegerField(item, "quantity", "بند الطلب"),
        lineTotalMinor: nonNegativeIntegerField(item, "lineTotalMinor", "بند الطلب"),
        tracked: item.tracked,
      };
    });
  }

  return receipt;
}

function mapBootstrap(value: unknown): StorefrontBootstrap {
  const envelope = record(value, "واجهة المتجر");
  const dto = record(envelope.data, "واجهة المتجر");
  return {
    workspaceRevision: nonNegativeIntegerField(dto, "workspaceRevision", "واجهة المتجر"),
    catalogRevision: nonNegativeIntegerField(dto, "catalogRevision", "واجهة المتجر"),
    config: mapStoreConfig(dto.config),
  };
}

function mapCreate(value: unknown): { replayed: boolean; order: OrderReceipt } {
  const envelope = record(value, "إنشاء الطلب");
  const dto = record(envelope.data, "إنشاء الطلب");
  if (typeof dto.replayed !== "boolean") return invalid("إنشاء الطلب");
  return { replayed: dto.replayed, order: mapReceipt(dto.order) };
}

function mapList(value: unknown): { items: OrderReceipt[]; total: number } {
  const envelope = record(value, "قائمة الطلبات");
  const dto = record(envelope.data, "قائمة الطلبات");
  const pagination = record(dto.pagination, "ترقيم الطلبات");
  return {
    items: arrayField(dto, "items", "قائمة الطلبات").map(mapReceipt),
    total: nonNegativeIntegerField(pagination, "total", "ترقيم الطلبات"),
  };
}

export const orderApi = {
  async loadStorefront(signal?: AbortSignal): Promise<StorefrontBootstrap> {
    return mapBootstrap(await apiClient.request("/api/store/config", { signal }));
  },

  async create(input: CreateOrderInput, idempotencyKey: string): Promise<{ replayed: boolean; order: OrderReceipt }> {
    return mapCreate(await apiClient.request("/api/store/orders", {
      method: "POST",
      body: input,
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
    }));
  },

  async list(tenantId: string): Promise<{ items: OrderReceipt[]; total: number }> {
    return mapList(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/orders`));
  },

  async updateStatus(tenantId: string, orderId: string, status: OrderReceipt["status"], reasonCode: string, idempotencyKey: string): Promise<OrderReceipt> {
    const envelope = record(await apiClient.request(`/api/merchant/stores/${encodeURIComponent(tenantId)}/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: { status, reasonCode },
      headers: { "Idempotency-Key": idempotencyKey },
      retrySafety: "idempotent",
    }), "تحديث الطلب");
    const data = record(envelope.data, "تحديث الطلب");
    return mapReceipt(data.order);
  },
};
