import { isUiError, uiErrorMessage } from "../contracts/uiError";

type StorefrontLoader<T> = (signal?: AbortSignal) => Promise<T>;

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, delayMs);
    const onAbort = () => {
      window.clearTimeout(timeout);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export function isTransientStorefrontFailure(error: unknown): boolean {
  return isUiError(error, "network") || isUiError(error, "server");
}

export async function loadPublicStorefrontWithRecovery<T>(
  loader: StorefrontLoader<T>,
  signal: AbortSignal,
  retryDelayMs = 600,
): Promise<T> {
  try {
    return await loader(signal);
  } catch (error) {
    if (signal.aborted) throw signal.reason ?? error;
    if (!isTransientStorefrontFailure(error)) throw error;
    await waitForRetry(retryDelayMs, signal);
    return loader(signal);
  }
}

export function publicStorefrontFailureMessage(error: unknown): string {
  if (isUiError(error, "not_found")) {
    return "لا يوجد متجر منشور لهذا العنوان حاليًا. تحقق من الرابط أو تواصل مع صاحب المتجر.";
  }
  if (isUiError(error, "network")) {
    return "تعذر الاتصال بخدمة المتجر مؤقتًا. تحقق من الاتصال ثم أعد المحاولة.";
  }
  if (isUiError(error, "server")) {
    return "خدمة المتجر غير متاحة مؤقتًا. انتظر لحظات ثم أعد المحاولة.";
  }
  return uiErrorMessage(error, "تعذر تحميل المتجر. أعد المحاولة، وإن استمرت المشكلة فتحقق من الرابط.");
}
