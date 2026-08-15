export type ApiErrorCategory =
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

interface ErrorPayload {
  message?: unknown;
  errors?: unknown;
  requestId?: unknown;
  meta?: { requestId?: unknown };
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  csrf?: boolean;
  retrySafety?: "idempotent";
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly category: ApiErrorCategory,
    public readonly status: number | null,
    public readonly errors: Record<string, string[]> = {},
    public readonly retryAfterSeconds: number | null = null,
    public readonly requestId: string | null = null,
    public readonly retryable = false,
    options: { cause?: unknown } = {},
  ) {
    super(message, options);
    this.name = "ApiError";
  }
}

const messages: Record<ApiErrorCategory, string> = {
  unauthenticated: "انتهت الجلسة أو لم يتم تسجيل الدخول.",
  forbidden: "لا تملك الصلاحية لتنفيذ هذا الإجراء.",
  conflict: "يتعارض الطلب مع الحالة الحالية للمورد.",
  csrf: "انتهت صلاحية الطلب الآمن. أعد المحاولة.",
  validation: "تحقق من البيانات المدخلة ثم أعد المحاولة.",
  throttled: "تم إرسال طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة.",
  server: "تعذر إكمال الطلب بسبب خطأ في الخادم. حاول لاحقًا.",
  network: "تعذر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.",
  aborted: "تم إلغاء الطلب.",
  unexpected: "تعذر إكمال الطلب. حاول مرة أخرى.",
};

function normalizeErrors(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(Object.entries(value)
    .filter(([, messages]) => Array.isArray(messages))
    .map(([field, fieldMessages]) => [
      field,
      (fieldMessages as unknown[]).filter((message): message is string => typeof message === "string"),
    ])
    .filter(([, fieldMessages]) => fieldMessages.length > 0));
}

function responseCategory(status: number): ApiErrorCategory {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 409) return "conflict";
  if (status === 419) return "csrf";
  if (status === 422) return "validation";
  if (status === 429) return "throttled";
  if (status >= 500) return "server";

  return "unexpected";
}

function retryAfterSeconds(response: Response): number | null {
  const value = response.headers.get("Retry-After");
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);

  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

interface DecodedResponse {
  payload: unknown;
  hasBody: boolean;
  validJson: boolean;
}

async function responsePayload(response: Response): Promise<DecodedResponse> {
  if (response.status === 204) return { payload: undefined, hasBody: false, validJson: true };
  const text = await response.text();
  if (!text) return { payload: undefined, hasBody: false, validJson: true };

  try {
    return { payload: JSON.parse(text) as unknown, hasBody: true, validJson: true };
  } catch {
    return { payload: undefined, hasBody: true, validJson: false };
  }
}

function requestId(response: Response, payload: ErrorPayload, fallback: string): string {
  const candidate = response.headers.get("X-Request-Id")
    ?? payload.requestId
    ?? payload.meta?.requestId;

  return typeof candidate === "string" && candidate.trim() ? candidate : fallback;
}

function responseError(response: Response, value: unknown, fallbackRequestId: string, safeToRetry: boolean): ApiError {
  const payload = value && typeof value === "object" ? value as ErrorPayload : {};
  const category = responseCategory(response.status);
  const errors = normalizeErrors(payload.errors);
  const validationMessage = Object.values(errors)[0]?.[0];
  const serverMessage = typeof payload.message === "string" ? payload.message : null;
  const safeMessage = category === "server"
    ? messages.server
    : validationMessage ?? serverMessage ?? messages[category];

  return new ApiError(
    safeMessage,
    category,
    response.status,
    errors,
    retryAfterSeconds(response),
    requestId(response, payload, fallbackRequestId),
    category === "csrf" || (safeToRetry && (category === "throttled" || category === "server")),
  );
}

function validatePath(path: string): void {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = "\\";
  }
  let target: URL | null = null;
  try {
    target = new URL(path, "https://eoshop.invalid");
  } catch {
    target = null;
  }

  if (
    !target
    || !path.startsWith("/")
    || path.startsWith("//")
    || path.includes("#")
    || decoded.includes("\\")
    || target.origin !== "https://eoshop.invalid"
  ) {
    throw new ApiError(
      "تم رفض عنوان API غير تابع للتطبيق.",
      "unexpected",
      null,
    );
  }
}

class SameOriginApiClient {
  private csrfToken: string | null = null;
  private csrfRequest: Promise<string> | null = null;
  private csrfGeneration = 0;

  async request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    validatePath(path);
    this.validateHeaders(options.headers);
    const method = options.method ?? "GET";
    const csrf = options.csrf ?? method !== "GET";
    const safeToRetry = method === "GET" || (
      options.retrySafety === "idempotent"
      && Object.keys(options.headers ?? {}).some((header) => header.toLowerCase() === "idempotency-key")
    );
    if (options.retrySafety === "idempotent" && !safeToRetry) {
      throw new ApiError("تتطلب إعادة المحاولة الآمنة مفتاح idempotency.", "unexpected", null);
    }
    const logicalRequestId = crypto.randomUUID();

    return this.execute<T>(path, { ...options, method, csrf }, true, logicalRequestId, safeToRetry);
  }

  clearCsrfToken(): void {
    this.csrfGeneration += 1;
    this.csrfToken = null;
    this.csrfRequest = null;
  }

  private async execute<T>(
    path: string,
    options: ApiRequestOptions & { method: NonNullable<ApiRequestOptions["method"]>; csrf: boolean },
    mayRecoverCsrf: boolean,
    logicalRequestId: string,
    safeToRetry: boolean,
  ): Promise<T> {
    const token = options.csrf
      ? await this.waitForCaller(this.csrf(), options.signal, logicalRequestId)
      : null;
    const headers: Record<string, string> = { ...options.headers };

    headers.Accept = "application/json";
    headers["X-Requested-With"] = "XMLHttpRequest";
    headers["X-Request-ID"] = logicalRequestId;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["X-CSRF-TOKEN"] = token;

    let response: Response;
    try {
      response = await fetch(path, {
        method: options.method,
        credentials: "same-origin",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: options.signal,
        redirect: "error",
      });
    } catch (cause) {
      throw this.transportError(cause, safeToRetry, logicalRequestId);
    }

    if (response.status === 419 && options.csrf && mayRecoverCsrf) {
      if (options.signal?.aborted) throw this.abortedError(options.signal.reason, logicalRequestId);
      this.csrfToken = null;
      await this.waitForCaller(this.csrf(), options.signal, logicalRequestId);

      return this.execute<T>(path, options, false, logicalRequestId, safeToRetry);
    }

    const decodedResponse = await responsePayload(response);
    if (!response.ok) throw responseError(response, decodedResponse.payload, logicalRequestId, safeToRetry);
    if (response.status !== 204 && (!decodedResponse.hasBody || !decodedResponse.validJson)) {
      throw new ApiError(
        messages.unexpected,
        "unexpected",
        response.status,
        {},
        null,
        response.headers.get("X-Request-Id") ?? logicalRequestId,
      );
    }

    return decodedResponse.payload as T;
  }

  private async csrf(): Promise<string> {
    if (this.csrfToken) return this.csrfToken;
    if (this.csrfRequest) return this.csrfRequest;

    const generation = this.csrfGeneration;
    let request!: Promise<string>;
    const logicalRequestId = crypto.randomUUID();
    request = this.execute<{ csrf_token: string }>(
      "/api/auth/csrf",
      { method: "GET", csrf: false },
      false,
      logicalRequestId,
      true,
    )
      .then((payload) => {
        if (typeof payload.csrf_token !== "string" || !payload.csrf_token) {
          throw new ApiError(messages.unexpected, "unexpected", null, {}, null, logicalRequestId);
        }
        if (generation === this.csrfGeneration) this.csrfToken = payload.csrf_token;

        return payload.csrf_token;
      })
      .finally(() => {
        if (this.csrfRequest === request) this.csrfRequest = null;
      });
    this.csrfRequest = request;

    return request;
  }

  private validateHeaders(headers: Record<string, string> | undefined): void {
    const allowed = new Set(["idempotency-key"]);
    const invalid = Object.keys(headers ?? {}).find((header) => !allowed.has(header.toLowerCase()));
    if (invalid) {
      throw new ApiError("تم رفض ترويسة API غير مسموح بها.", "unexpected", null);
    }
  }

  private transportError(cause: unknown, safeToRetry: boolean, logicalRequestId: string): ApiError {
    const aborted = (cause instanceof Error && cause.name === "AbortError")
      || (typeof DOMException !== "undefined" && cause instanceof DOMException && cause.name === "AbortError");

    return new ApiError(
      messages[aborted ? "aborted" : "network"],
      aborted ? "aborted" : "network",
      null,
      {},
      null,
      logicalRequestId,
      !aborted && safeToRetry,
      { cause },
    );
  }

  private abortedError(cause: unknown, logicalRequestId: string | null = null): ApiError {
    return new ApiError(messages.aborted, "aborted", null, {}, null, logicalRequestId, false, { cause });
  }

  private waitForCaller<T>(promise: Promise<T>, signal: AbortSignal | undefined, logicalRequestId: string): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(this.abortedError(signal.reason, logicalRequestId));

    return new Promise<T>((resolve, reject) => {
      const abort = () => reject(this.abortedError(signal.reason, logicalRequestId));
      signal.addEventListener("abort", abort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }
}

export const apiClient = new SameOriginApiClient();

export function toApiError(cause: unknown): ApiError {
  if (cause instanceof ApiError) return cause;

  return new ApiError(messages.unexpected, "unexpected", null, {}, null, null, false, { cause });
}
