import { useEffect, useRef } from "react";

export const LIFECYCLE_POLL_INTERVAL_MS = 5_000;
export const LIFECYCLE_POLL_MAX_ATTEMPTS = 24;

const transitionalProvisioningStatuses = new Set([
  "not_started",
  "queued",
  "provisioning",
  "retrying",
]);

export function isProvisioningTransition(status: string): boolean {
  return transitionalProvisioningStatuses.has(status);
}

export function shouldPollMerchantLifecycle(
  verificationStatus: string,
  provisioningStatus: string,
): boolean {
  return verificationStatus === "pending"
    || (verificationStatus === "approved" && isProvisioningTransition(provisioningStatus));
}

interface LifecyclePollingOptions {
  enabled: boolean;
  pollKey: string;
  refresh: () => void | Promise<void>;
  intervalMs?: number;
  maxAttempts?: number;
}

export function useLifecyclePolling({
  enabled,
  pollKey,
  refresh,
  intervalMs = LIFECYCLE_POLL_INTERVAL_MS,
  maxAttempts = LIFECYCLE_POLL_MAX_ATTEMPTS,
}: LifecyclePollingOptions): void {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || maxAttempts <= 0) return undefined;

    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;

    const schedule = () => {
      timer = window.setTimeout(async () => {
        attempts += 1;
        try {
          await refreshRef.current();
        } catch {
          // The owning screen presents refresh errors; polling remains bounded and retryable.
        } finally {
          if (!cancelled && attempts < maxAttempts) schedule();
        }
      }, intervalMs);
    };

    schedule();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [enabled, intervalMs, maxAttempts, pollKey]);
}
