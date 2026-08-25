// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isProvisioningTransition,
  shouldPollMerchantLifecycle,
  useLifecyclePolling,
} from "./useLifecyclePolling";

function PollingHarness({
  enabled,
  refresh,
}: {
  enabled: boolean;
  refresh: (signal: AbortSignal) => Promise<void>;
}) {
  useLifecyclePolling({ enabled, pollKey: "test-store", refresh, intervalMs: 10, maxAttempts: 2 });
  return null;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useLifecyclePolling", () => {
  it("recognizes only the server lifecycle states that can advance", () => {
    expect(isProvisioningTransition("not_started")).toBe(true);
    expect(isProvisioningTransition("queued")).toBe(true);
    expect(isProvisioningTransition("provisioning")).toBe(true);
    expect(isProvisioningTransition("retrying")).toBe(true);
    expect(isProvisioningTransition("active")).toBe(false);
    expect(isProvisioningTransition("failed")).toBe(false);
    expect(shouldPollMerchantLifecycle("pending", "not_started")).toBe(true);
    expect(shouldPollMerchantLifecycle("approved", "queued")).toBe(true);
    expect(shouldPollMerchantLifecycle("approved", "active")).toBe(false);
    expect(shouldPollMerchantLifecycle("rejected", "not_started")).toBe(false);
  });

  it("polls sequentially, stops at the bound, and cancels when disabled", async () => {
    vi.useFakeTimers();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const view = render(<PollingHarness enabled refresh={refresh} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(refresh).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(refresh).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(refresh).toHaveBeenCalledTimes(2);

    view.rerender(<PollingHarness enabled={false} refresh={refresh} />);
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("aborts an in-flight refresh when the polling screen unmounts", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | null = null;
    const refresh = vi.fn((signal: AbortSignal) => {
      observedSignal = signal;
      return new Promise<void>(() => undefined);
    });
    const view = render(<PollingHarness enabled refresh={refresh} />);

    act(() => { vi.advanceTimersByTime(10); });
    expect(refresh).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(observedSignal?.aborted).toBe(true);
  });
});
