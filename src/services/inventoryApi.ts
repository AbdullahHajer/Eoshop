import { apiClient, ApiError } from "./apiClient";
import { arrayField, booleanField, numberField, record, stringField } from "./apiContract";
import { randomUuid } from "../utils/randomUuid";

export interface InventoryItem {
  productId: string;
  name?: string;
  sku?: string | null;
  onHand: number;
  reserved: number;
  available: number | null;
  manageStock: boolean;
  lowStockThreshold: number;
  inventoryRevision: number;
}

export interface InventoryAdjustmentLine {
  productId: string;
  expectedInventoryRevision: number;
  movementKind: "receive" | "issue" | "return" | "correction";
  delta: number;
}

export interface InventoryMutationResult {
  tenantId: string;
  operationId: string;
  replayed: boolean;
  items: InventoryItem[];
}

export interface InventoryPolicyMutationResult {
  tenantId: string;
  operationId: string;
  replayed: boolean;
  item: InventoryItem;
}

function invalid(): never {
  throw new ApiError("استجابة الخادم لا تطابق عقد المخزون.", "unexpected", 200);
}

function nullableNumber(source: Record<string, unknown>, key: string): number | null {
  if (source[key] === null) return null;
  return numberField(source, key, "المخزون");
}

function mapItem(value: unknown): InventoryItem {
  const dto = record(value, "عنصر المخزون");
  const sku = dto.sku;
  if (sku !== undefined && sku !== null && typeof sku !== "string") return invalid();

  return {
    productId: stringField(dto, "productId", "عنصر المخزون"),
    name: typeof dto.name === "string" ? dto.name : undefined,
    sku: sku as string | null | undefined,
    onHand: numberField(dto, "onHand", "عنصر المخزون"),
    reserved: numberField(dto, "reserved", "عنصر المخزون"),
    available: nullableNumber(dto, "available"),
    manageStock: booleanField(dto, "manageStock", "عنصر المخزون"),
    lowStockThreshold: numberField(dto, "lowStockThreshold", "عنصر المخزون"),
    inventoryRevision: numberField(dto, "inventoryRevision", "عنصر المخزون"),
  };
}

function mapMutation(value: unknown): InventoryMutationResult {
  const envelope = record(value, "استجابة المخزون");
  const dto = record(envelope.data, "عملية المخزون");

  return {
    tenantId: stringField(dto, "tenantId", "عملية المخزون"),
    operationId: stringField(dto, "operationId", "عملية المخزون"),
    replayed: booleanField(dto, "replayed", "عملية المخزون"),
    items: arrayField(dto, "items", "عملية المخزون").map(mapItem),
  };
}

function mapPolicy(value: unknown): InventoryPolicyMutationResult {
  const envelope = record(value, "استجابة سياسة المخزون");
  const dto = record(envelope.data, "سياسة المخزون");
  return {
    tenantId: stringField(dto, "tenantId", "سياسة المخزون"),
    operationId: stringField(dto, "operationId", "سياسة المخزون"),
    replayed: booleanField(dto, "replayed", "سياسة المخزون"),
    item: mapItem(dto.item),
  };
}

export const inventoryApi = {
  async load(tenantId: string, signal?: AbortSignal): Promise<InventoryItem[]> {
    const envelope = record(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/inventory`,
      { signal },
    ), "استجابة المخزون");
    return arrayField(record(envelope.data, "المخزون"), "items", "المخزون").map(mapItem);
  },

  async adjust(
    tenantId: string,
    lines: InventoryAdjustmentLine[],
    reasonCode: string,
    note?: string,
    idempotencyKey = randomUuid(),
    signal?: AbortSignal,
  ): Promise<InventoryMutationResult> {
    return mapMutation(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/inventory/adjustments`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        retrySafety: "idempotent",
        body: { lines, reasonCode, note },
        signal,
      },
    ));
  },

  async updatePolicy(
    tenantId: string,
    productId: string,
    expectedInventoryRevision: number,
    manageStock: boolean,
    lowStockThreshold: number,
    idempotencyKey = randomUuid(),
    signal?: AbortSignal,
  ): Promise<InventoryPolicyMutationResult> {
    return mapPolicy(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/inventory/products/${encodeURIComponent(productId)}/policy`,
      {
        method: "PATCH",
        headers: { "Idempotency-Key": idempotencyKey },
        retrySafety: "idempotent",
        body: { expectedInventoryRevision, manageStock, lowStockThreshold },
        signal,
      },
    ));
  },
};
