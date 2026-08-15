import { ApiError } from "./apiClient";

type JsonRecord = Record<string, unknown>;

function failure(contract: string): never {
  throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
}

export function record(value: unknown, contract: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return failure(contract);

  return value as JsonRecord;
}

export function stringField(source: JsonRecord, key: string, contract: string): string {
  const value = source[key];
  if (typeof value !== "string") return failure(contract);

  return value;
}

export function nullableStringField(source: JsonRecord, key: string, contract: string): string | null {
  const value = source[key];
  if (value !== null && typeof value !== "string") return failure(contract);

  return value as string | null;
}

export function numberField(source: JsonRecord, key: string, contract: string): number {
  const value = source[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return failure(contract);

  return value;
}

export function nullableNumberField(source: JsonRecord, key: string, contract: string): number | null {
  const value = source[key];
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) return failure(contract);

  return value;
}

export function booleanField(source: JsonRecord, key: string, contract: string): boolean {
  const value = source[key];
  if (typeof value !== "boolean") return failure(contract);

  return value;
}

export function stringArrayField(source: JsonRecord, key: string, contract: string): string[] {
  const value = source[key];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return failure(contract);

  return [...value] as string[];
}

export function enumField<const T extends readonly string[]>(
  source: JsonRecord,
  key: string,
  values: T,
  contract: string,
): T[number] {
  const value = source[key];
  if (typeof value !== "string" || !values.includes(value)) return failure(contract);

  return value as T[number];
}

export function arrayField(source: JsonRecord, key: string, contract: string): unknown[] {
  const value = source[key];
  if (!Array.isArray(value)) return failure(contract);

  return value;
}
