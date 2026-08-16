export type UiErrorCategory =
  | "unauthenticated"
  | "forbidden"
  | "conflict"
  | "csrf"
  | "validation"
  | "throttled"
  | "server"
  | "network"
  | "aborted"
  | "unexpected";

export interface UiErrorShape extends Error {
  readonly category: UiErrorCategory;
  readonly code: string | null;
}

const categories: readonly UiErrorCategory[] = [
  "unauthenticated",
  "forbidden",
  "conflict",
  "csrf",
  "validation",
  "throttled",
  "server",
  "network",
  "aborted",
  "unexpected",
];

export class UiAdapterError extends Error implements UiErrorShape {
  constructor(
    message: string,
    public readonly category: UiErrorCategory,
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "UiAdapterError";
  }
}

export function uiError(error: unknown): UiErrorShape | null {
  if (!(error instanceof Error)) return null;
  const candidate = error as Error & { category?: unknown; code?: unknown };
  if (!categories.includes(candidate.category as UiErrorCategory)) return null;
  if (candidate.code !== null && typeof candidate.code !== "string") return null;
  return candidate as UiErrorShape;
}

export function isUiError(error: unknown, category: UiErrorCategory): boolean {
  return uiError(error)?.category === category;
}

export function isUiErrorCode(error: unknown, category: UiErrorCategory, code: string): boolean {
  const normalized = uiError(error);
  return normalized?.category === category && normalized.code === code;
}

export function uiErrorMessage(error: unknown, fallback: string): string {
  return uiError(error)?.message ?? fallback;
}
