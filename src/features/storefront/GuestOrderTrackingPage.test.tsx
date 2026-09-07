// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GuestOrderTracking } from "../../adapters/uiAdapters";
import GuestOrderTrackingPage from "./GuestOrderTrackingPage";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const capability = "eot1.private-capability-that-must-not-render";

const tracking: GuestOrderTracking = {
  number: "EO-2026-1042",
  orderStatus: "accepted",
  fulfillmentStatus: "preparing",
  createdAt: "2026-09-06T08:00:00Z",
  updatedAt: "2026-09-06T09:00:00Z",
  timeline: [
    { stage: "submitted", occurredAt: "2026-09-06T08:00:00Z" },
    { stage: "accepted", occurredAt: "2026-09-06T08:20:00Z" },
    { stage: "preparing", occurredAt: "2026-09-06T09:00:00Z" },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, reject, resolve };
}

describe("guest order tracking page", () => {
  it("shows a focused missing or invalid-link state without attempting a lookup", () => {
    const lookupOrder = vi.fn();
    const { rerender } = render(<GuestOrderTrackingPage capability={null} lookupOrder={lookupOrder} />);

    const missing = screen.getByTestId("tracking-missing");
    expect(missing.textContent).toContain("رابط التتبع غير مكتمل");
    expect(document.activeElement).toBe(missing);
    expect(lookupOrder).not.toHaveBeenCalled();

    rerender(<GuestOrderTrackingPage capability={capability} invalidCapability lookupOrder={lookupOrder} />);
    expect(screen.getByTestId("tracking-missing").textContent).toContain("تعذّر فتح رابط التتبع");
    expect(document.body.textContent).not.toContain(capability);
    expect(lookupOrder).not.toHaveBeenCalled();
  });

  it("passes the route capability only to the lookup, exposes loading accessibly, and aborts on unmount", () => {
    const request = deferred<GuestOrderTracking>();
    let receivedSignal: AbortSignal | undefined;
    const lookupOrder = vi.fn((receivedCapability: string, signal?: AbortSignal) => {
      expect(receivedCapability).toBe(capability);
      receivedSignal = signal;
      return request.promise;
    });
    const { container, unmount } = render(<GuestOrderTrackingPage capability={capability} lookupOrder={lookupOrder} />);

    const loading = screen.getByRole("status");
    expect(loading.getAttribute("data-testid")).toBe("tracking-loading");
    expect(loading.textContent).toContain("جارٍ جلب آخر حالة مسجّلة");
    expect(container.querySelector(".motion-reduce\\:animate-none")).toBeTruthy();
    expect(container.innerHTML).not.toContain(capability);
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);

    unmount();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it("renders only the public projection and the actual timeline events with correct bidi isolation", async () => {
    const responseWithPrivateFields = {
      ...tracking,
      customer: { name: "اسم خاص", phone: "777000111" },
      address: "عنوان خاص",
      payment: { reference: "PAYMENT-SECRET" },
    } as GuestOrderTracking;
    const { container } = render(
      <GuestOrderTrackingPage capability={capability} lookupOrder={vi.fn().mockResolvedValue(responseWithPrivateFields)} />,
    );

    const success = await screen.findByTestId("tracking-success");
    expect(document.activeElement).toBe(success);
    expect(screen.getByRole("main").getAttribute("dir")).toBe("rtl");
    expect(screen.getByText(tracking.number).closest("[dir='ltr']")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "الطلب قيد التجهيز" })).toBeTruthy();

    const timeline = screen.getByRole("list", { name: "الأحداث الفعلية المسجّلة للطلب" });
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(tracking.timeline.length);
    expect(within(timeline).getByText("استلم المتجر الطلب")).toBeTruthy();
    expect(within(timeline).getByText("بدأ تجهيز الطلب")).toBeTruthy();
    expect(within(timeline).queryByText("خرج الطلب للتوصيل")).toBeNull();
    expect(within(timeline).queryByText("سُجّل تسليم الطلب")).toBeNull();

    expect(container.textContent).not.toContain("اسم خاص");
    expect(container.textContent).not.toContain("777000111");
    expect(container.textContent).not.toContain("عنوان خاص");
    expect(container.textContent).not.toContain("PAYMENT-SECRET");
    expect(container.innerHTML).not.toContain(capability);
  });

  it("refreshes a successful lookup manually while keeping the current result visible", async () => {
    const nextRequest = deferred<GuestOrderTracking>();
    const delivered: GuestOrderTracking = {
      ...tracking,
      orderStatus: "completed",
      fulfillmentStatus: "delivered",
      updatedAt: "2026-09-06T11:00:00Z",
      timeline: [
        ...tracking.timeline,
        { stage: "dispatched", occurredAt: "2026-09-06T10:00:00Z" },
        { stage: "delivered", occurredAt: "2026-09-06T11:00:00Z" },
      ],
    };
    const lookupOrder = vi.fn()
      .mockResolvedValueOnce(tracking)
      .mockReturnValueOnce(nextRequest.promise);
    const user = userEvent.setup();
    render(<GuestOrderTrackingPage capability={capability} lookupOrder={lookupOrder} />);

    expect(await screen.findByRole("button", { name: "تحديث الحالة" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحديث الحالة" }));

    const busyButton = screen.getByRole("button", { name: "جارٍ تحديث الحالة" });
    expect((busyButton as HTMLButtonElement).disabled).toBe(true);
    expect(busyButton.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("heading", { name: "الطلب قيد التجهيز" })).toBeTruthy();
    await waitFor(() => expect(lookupOrder).toHaveBeenCalledTimes(2));

    await act(async () => nextRequest.resolve(delivered));

    expect(await screen.findByRole("heading", { name: "سُجّل تسليم الطلب" })).toBeTruthy();
    expect(screen.getByText("سُجّل تسليم الطلب", { selector: "p" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "تحديث الحالة" }) as HTMLButtonElement).disabled).toBe(false);
    expect(document.body.innerHTML).not.toContain(capability);
  });

  it("revalidates once after a bfcache restore without exposing or racing the capability", async () => {
    const restoredRequest = deferred<GuestOrderTracking>();
    const lookupOrder = vi.fn()
      .mockResolvedValueOnce(tracking)
      .mockReturnValueOnce(restoredRequest.promise);
    const { unmount } = render(<GuestOrderTrackingPage capability={capability} lookupOrder={lookupOrder} />);

    expect(await screen.findByTestId("tracking-success")).toBeTruthy();
    const restored = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(restored, "persisted", { value: true });
    act(() => {
      window.dispatchEvent(restored);
      window.dispatchEvent(restored);
    });

    await waitFor(() => expect(lookupOrder).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "جارٍ تحديث الحالة" })).toBeTruthy();
    expect(document.body.innerHTML).not.toContain(capability);

    unmount();
    expect((lookupOrder.mock.calls[1][1] as AbortSignal).aborted).toBe(true);
    window.dispatchEvent(restored);
    expect(lookupOrder).toHaveBeenCalledTimes(2);
  });

  it("does not infer delivery from a legacy completed order", async () => {
    render(<GuestOrderTrackingPage capability={capability} lookupOrder={vi.fn().mockResolvedValue({
      ...tracking,
      orderStatus: "completed",
      fulfillmentStatus: "legacy_completed",
      timeline: [
        { stage: "submitted", occurredAt: "2026-09-06T08:00:00Z" },
        { stage: "legacy_completed", occurredAt: "2026-09-06T09:00:00Z" },
      ],
    })} />);

    const success = await screen.findByTestId("tracking-success");
    expect(success.textContent).toContain("لا تعني وحدها أن الطلب شُحن أو سُلّم");
    expect(screen.queryByText("سُجّل تسليم الطلب")).toBeNull();
  });

  it("offers a focused safe retry after a transient failure", async () => {
    const user = userEvent.setup();
    const lookupOrder = vi.fn()
      .mockRejectedValueOnce({ category: "network", retryable: true, message: capability })
      .mockResolvedValueOnce(tracking);
    render(<GuestOrderTrackingPage capability={capability} lookupOrder={lookupOrder} />);

    const retryState = await screen.findByTestId("tracking-retry");
    expect(document.activeElement).toBe(retryState);
    expect(retryState.textContent).not.toContain(capability);
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));

    expect(await screen.findByTestId("tracking-success")).toBeTruthy();
    expect(lookupOrder).toHaveBeenCalledTimes(2);
  });

  it("keeps terminal lookup failures generic and never renders server error details", async () => {
    render(<GuestOrderTrackingPage capability={capability} lookupOrder={vi.fn().mockRejectedValue({
      category: "not_found",
      status: 404,
      message: `No order for ${capability}`,
    })} />);

    const error = await screen.findByTestId("tracking-error");
    expect(error.textContent).toContain("تعذّر فتح تتبع الطلب");
    expect(error.textContent).not.toContain("No order");
    expect(error.textContent).not.toContain(capability);
    expect(document.activeElement).toBe(error);
  });

  it("honors the throttle delay before enabling another lookup", async () => {
    vi.useFakeTimers();
    const lookupOrder = vi.fn()
      .mockRejectedValueOnce({ category: "throttled", status: 429, retryAfterSeconds: 2 })
      .mockResolvedValueOnce(tracking);
    render(<GuestOrderTrackingPage capability={capability} lookupOrder={lookupOrder} />);

    await act(async () => Promise.resolve());
    const throttle = screen.getByTestId("tracking-throttle");
    const retryButton = within(throttle).getByRole("button", { name: "إعادة المحاولة" });
    expect((retryButton as HTMLButtonElement).disabled).toBe(true);
    expect(throttle.textContent).toContain("طلبات كثيرة خلال وقت قصير");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect((retryButton as HTMLButtonElement).disabled).toBe(false);

    retryButton.click();
    await act(async () => Promise.resolve());
    expect(screen.getByTestId("tracking-success")).toBeTruthy();
    expect(lookupOrder).toHaveBeenCalledTimes(2);
  });

  it("aborts the superseded request when the route capability changes", async () => {
    const first = deferred<GuestOrderTracking>();
    const second = deferred<GuestOrderTracking>();
    const signals: AbortSignal[] = [];
    const lookupOrder = vi.fn((_value: string, signal?: AbortSignal) => {
      if (signal) signals.push(signal);
      return signals.length === 1 ? first.promise : second.promise;
    });
    const { rerender } = render(<GuestOrderTrackingPage capability="eot1.first" lookupOrder={lookupOrder} />);

    rerender(<GuestOrderTrackingPage capability="eot1.second" lookupOrder={lookupOrder} />);
    await waitFor(() => expect(lookupOrder).toHaveBeenCalledTimes(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    second.resolve(tracking);
    expect(await screen.findByTestId("tracking-success")).toBeTruthy();
  });
});
