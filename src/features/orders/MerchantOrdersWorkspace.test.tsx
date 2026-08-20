// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { OrderReceipt } from "../../adapters/uiAdapters";
import MerchantOrdersWorkspace from "../../components/MerchantOrdersWorkspace";

const receipt: OrderReceipt = { id: "order-1", number: "EO-1", status: "submitted", allowedTransitions: ["accepted"], paymentState: "due_on_delivery", currencyCode: "YER", totals: { itemsSubtotalMinor: 100, discountMinor: 0, shippingMinor: 0, taxMinor: 0, paymentFeeMinor: 0, grandTotalMinor: 100 }, createdAt: "2026-08-19T10:00:00Z", checkoutPresentation: { title: "تم استلام طلبك", message: "احتفظ برقم الطلب للمتابعة مع المتجر.", whatsappTarget: null } };

afterEach(cleanup);

describe("MerchantOrdersWorkspace", () => {
  it("reuses the same transition key after an ambiguous failure", async () => {
    const authoritative = { ...receipt, status: "processing" as const, allowedTransitions: ["completed" as const] };
    const updateStatus = vi.fn()
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({ replayed: true, order: { ...receipt, status: "accepted", allowedTransitions: ["processing"] } });
    const list = vi.fn()
      .mockResolvedValueOnce({ items: [receipt], total: 1 })
      .mockResolvedValueOnce({ items: [authoritative], total: 1 });
    const adapters = createFakeUiAdapters({ orders: { list, updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    await screen.findByRole("button", { name: "قبول الطلب" });
    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await operator.click(screen.getByRole("button", { name: "قبول الطلب" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
    expect(updateStatus.mock.calls[0][4]).toBe(updateStatus.mock.calls[1][4]);
    expect(await screen.findByRole("button", { name: "إكمال الطلب" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "بدء التجهيز" })).toBeNull();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("prevents refresh and transition requests from overlapping", async () => {
    let resolveRefresh!: (value: { items: OrderReceipt[]; total: number }) => void;
    let resolveTransition!: (value: { replayed: boolean; order: OrderReceipt }) => void;
    const refresh = new Promise<{ items: OrderReceipt[]; total: number }>((resolve) => { resolveRefresh = resolve; });
    const transition = new Promise<{ replayed: boolean; order: OrderReceipt }>((resolve) => { resolveTransition = resolve; });
    const list = vi.fn().mockResolvedValueOnce({ items: [receipt], total: 1 }).mockReturnValueOnce(refresh);
    const updateStatus = vi.fn().mockReturnValueOnce(transition);
    const adapters = createFakeUiAdapters({ orders: { list, updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    const accept = await screen.findByRole("button", { name: "قبول الطلب" });
    await operator.click(screen.getByRole("button", { name: "تحديث" }));
    expect((accept as HTMLButtonElement).disabled).toBe(true);
    resolveRefresh({ items: [receipt], total: 1 });
    await waitFor(() => expect((accept as HTMLButtonElement).disabled).toBe(false));

    await operator.click(accept);
    expect((screen.getByRole("button", { name: "تحديث" }) as HTMLButtonElement).disabled).toBe(true);
    resolveTransition({ replayed: false, order: { ...receipt, status: "accepted", allowedTransitions: ["processing"] } });
    expect(await screen.findByRole("button", { name: "بدء التجهيز" })).toBeTruthy();
  });

  it("serializes transitions for different orders", async () => {
    const second = { ...receipt, id: "order-2", number: "EO-2" };
    let resolveFirst!: (value: { replayed: boolean; order: OrderReceipt }) => void;
    const first = new Promise<{ replayed: boolean; order: OrderReceipt }>((resolve) => { resolveFirst = resolve; });
    const updateStatus = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ replayed: false, order: { ...second, status: "accepted", allowedTransitions: ["processing"] } });
    const adapters = createFakeUiAdapters({ orders: { list: vi.fn(async () => ({ items: [receipt, second], total: 2 })), updateStatus } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOrdersWorkspace tenantId="tenant-a" canView /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    const buttons = await screen.findAllByRole("button", { name: "قبول الطلب" }) as HTMLButtonElement[];
    await operator.click(buttons[0]);
    expect(buttons[1].disabled).toBe(true);
    expect(updateStatus).toHaveBeenCalledTimes(1);

    resolveFirst({ replayed: false, order: { ...receipt, status: "accepted", allowedTransitions: ["processing"] } });
    await waitFor(() => expect(buttons[1].disabled).toBe(false));
    await operator.click(screen.getAllByRole("button", { name: "قبول الطلب" })[0]);
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
    expect(screen.getAllByRole("button", { name: "بدء التجهيز" })).toHaveLength(2);
  });
});
