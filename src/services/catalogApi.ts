import { apiClient, ApiError } from "./apiClient";
import { numberField, record, stringField } from "./apiContract";

export interface CatalogMediaUpload {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
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
  async uploadMedia(tenantId: string, file: File, signal?: AbortSignal): Promise<CatalogMediaUpload> {
    const idempotencyKey = crypto.randomUUID();
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
