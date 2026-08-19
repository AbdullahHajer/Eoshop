// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import MerchantInventoryPanel from "../../components/MerchantInventoryPanel";

const item = { productId: "product-1", name: "عطر", sku: "SKU-1", onHand: 5, reserved: 1, available: 4, manageStock: true, lowStockThreshold: 2, inventoryRevision: 3 };

afterEach(cleanup);

describe("MerchantInventoryPanel", () => {
  it("keeps the adjustment idempotency key stable after an ambiguous failure", async () => {
    const authoritative = { ...item, onHand: 9, available: 8, inventoryRevision: 5 };
    const adjust = vi.fn()
      .mockRejectedValueOnce(new Error("network result unknown"))
      .mockResolvedValueOnce({ tenantId: "tenant-a", operationId: "op-1", replayed: true, items: [{ ...item, onHand: 7, available: 6, inventoryRevision: 4 }] });
    const load = vi.fn().mockResolvedValueOnce([item]).mockResolvedValueOnce([authoritative]);
    const adapters = createFakeUiAdapters({ inventory: { load, adjust } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantInventoryPanel tenantId="tenant-a" canView canManage /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    const input = await screen.findByRole("spinbutton", { name: "الرصيد الفعلي عطر" });
    await operator.clear(input); await operator.type(input, "7");
    await operator.click(screen.getByRole("button", { name: "تسجيل التسوية" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    await operator.click(screen.getByRole("button", { name: "تسجيل التسوية" }));
    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(2));
    expect(adjust.mock.calls[0][4]).toBe(adjust.mock.calls[1][4]);
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "الرصيد الفعلي عطر" }) as HTMLInputElement).value).toBe("9"));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("prevents refresh and inventory mutations from overlapping", async () => {
    let resolveRefresh!: (value: typeof item[]) => void;
    let resolveAdjustment!: (value: { tenantId: string; operationId: string; replayed: boolean; items: typeof item[] }) => void;
    const refresh = new Promise<typeof item[]>((resolve) => { resolveRefresh = resolve; });
    const adjustment = new Promise<{ tenantId: string; operationId: string; replayed: boolean; items: typeof item[] }>((resolve) => { resolveAdjustment = resolve; });
    const load = vi.fn().mockResolvedValueOnce([item]).mockReturnValueOnce(refresh);
    const adjust = vi.fn().mockReturnValueOnce(adjustment);
    const adapters = createFakeUiAdapters({ inventory: { load, adjust } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantInventoryPanel tenantId="tenant-a" canView canManage /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    const input = await screen.findByRole("spinbutton", { name: "الرصيد الفعلي عطر" }) as HTMLInputElement;
    await operator.click(screen.getByRole("button", { name: "تحديث" }));
    expect(input.disabled).toBe(true);
    resolveRefresh([item]);
    await waitFor(() => expect(input.disabled).toBe(false));

    await operator.clear(input); await operator.type(input, "7");
    await operator.click(screen.getByRole("button", { name: "تسجيل التسوية" }));
    expect((screen.getByRole("button", { name: "تحديث" }) as HTMLButtonElement).disabled).toBe(true);
    resolveAdjustment({ tenantId: "tenant-a", operationId: "op-2", replayed: false, items: [{ ...item, onHand: 7, available: 6, inventoryRevision: 4 }] });
    await waitFor(() => expect((screen.getByRole("spinbutton", { name: "الرصيد الفعلي عطر" }) as HTMLInputElement).value).toBe("7"));
  });

  it("serializes mutations for different products without leaving either product pending", async () => {
    const second = { ...item, productId: "product-2", name: "بخور", sku: "SKU-2", onHand: 3, reserved: 0, available: 3 };
    let resolveFirst!: (value: { tenantId: string; operationId: string; replayed: boolean; items: typeof item[] }) => void;
    const first = new Promise<{ tenantId: string; operationId: string; replayed: boolean; items: typeof item[] }>((resolve) => { resolveFirst = resolve; });
    const adjust = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ tenantId: "tenant-a", operationId: "op-b", replayed: false, items: [{ ...second, onHand: 5, available: 5, inventoryRevision: 4 }] });
    const adapters = createFakeUiAdapters({ inventory: { load: vi.fn(async () => [item, second]), adjust } });
    render(<UiAdaptersProvider adapters={adapters}><MerchantInventoryPanel tenantId="tenant-a" canView canManage /></UiAdaptersProvider>);
    const operator = userEvent.setup();

    const firstInput = await screen.findByRole("spinbutton", { name: "الرصيد الفعلي عطر" }) as HTMLInputElement;
    const secondInput = screen.getByRole("spinbutton", { name: "الرصيد الفعلي بخور" }) as HTMLInputElement;
    await operator.clear(firstInput); await operator.type(firstInput, "7");
    await operator.clear(secondInput); await operator.type(secondInput, "5");
    const buttons = screen.getAllByRole("button", { name: "تسجيل التسوية" }) as HTMLButtonElement[];
    await operator.click(buttons[0]);
    expect(buttons[1].disabled).toBe(true);
    expect(adjust).toHaveBeenCalledTimes(1);

    resolveFirst({ tenantId: "tenant-a", operationId: "op-a", replayed: false, items: [{ ...item, onHand: 7, available: 6, inventoryRevision: 4 }] });
    await waitFor(() => expect(buttons[1].disabled).toBe(false));
    const currentSecondInput = screen.getByRole("spinbutton", { name: "الرصيد الفعلي بخور" }) as HTMLInputElement;
    await operator.clear(currentSecondInput); await operator.type(currentSecondInput, "5");
    await operator.click(screen.getAllByRole("button", { name: "تسجيل التسوية" })[1]);
    await waitFor(() => expect(adjust).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(firstInput.value).toBe("7"));
    await waitFor(() => expect(secondInput.value).toBe("5"));
    expect(firstInput.disabled).toBe(false);
    expect(secondInput.disabled).toBe(false);
    expect((screen.getByRole("button", { name: "تحديث" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
