import { apiClient, ApiError } from "./apiClient";
import type { Product } from "../types";
import { arrayField, numberField, record, stringField } from "./apiContract";
import { mapProduct } from "./workspaceApi";
import { randomUuid } from "../utils/randomUuid";

export interface CatalogMediaUpload {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
}

export interface CatalogSnapshot {
  tenantId: string;
  revision: number;
  currencyCode: string;
  products: Product[];
}

function mapCatalog(value: unknown): CatalogSnapshot {
  const envelope = record(value, "استجابة كتالوج المتجر");
  const dto = record(envelope.data, "كتالوج المتجر");
  return {
    tenantId: stringField(dto, "tenantId", "كتالوج المتجر"),
    revision: numberField(dto, "revision", "كتالوج المتجر"),
    currencyCode: stringField(dto, "currencyCode", "كتالوج المتجر"),
    products: arrayField(dto, "products", "كتالوج المتجر").map(mapProduct),
  };
}

function mapUpload(value: unknown): CatalogMediaUpload {
  const envelope = record(value, "رفع صورة المنتج");
  const dto = record(envelope.data, "صورة المنتج");
  const mimeType = stringField(dto, "mimeType", "صورة المنتج");
  if (!(["image/jpeg", "image/png", "image/webp"] as const).includes(mimeType as "image/jpeg")) {
    throw new ApiError("استجابة الخادم لا تطابق عقد صورة المنتج.", "unexpected", 200);
  }

  return {
    id: stringField(dto, "id", "صورة المنتج"),
    url: stringField(dto, "url", "صورة المنتج"),
    mimeType,
    byteSize: numberField(dto, "byteSize", "صورة المنتج"),
  };
}

export const catalogApi = {
  async load(tenantId: string, signal?: AbortSignal): Promise<CatalogSnapshot> {
    return mapCatalog(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/catalog`,
      { signal },
    ));
  },

  async uploadMedia(tenantId: string, file: File, signal?: AbortSignal): Promise<CatalogMediaUpload> {
    const idempotencyKey = randomUuid();
    const body = new FormData();
    body.append("image", file);
    body.append("idempotencyKey", idempotencyKey);

    return mapUpload(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/catalog/media`,
      {
        method: "POST",
        body,
        headers: { "Idempotency-Key": idempotencyKey },
        retrySafety: "idempotent",
        signal,
      },
    ));
  },
};
