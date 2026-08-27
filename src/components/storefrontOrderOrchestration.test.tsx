// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://shop.example.test/"}

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { UiAdaptersProvider } from "../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../adapters/testing/fakeUiAdapters";
import { UiAdapterError } from "../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../types";

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Server Product",
  price: 10,
  description: "Server product",
  category: "General",
  imageKeyword: "product",
  status: "published" as const,
  manageStock: true,
  stockQuantity: 10,
  availableQuantity: 10,
};

const storefront = (price: number) => ({
  workspaceRevision: price === 10 ? 1 : 2,
  catalogRevision: price === 10 ? 1 : 2,
  config: {
    ...ELEGANT_PRESET,
    storeName: "Live Server Store",
    products: [{ ...product, price }],
    currency: "YER",
    requireEmail: false,
    enableCashOnDelivery: true,
    enableBankTransfer: false,
    enableEWallets: false,
  },
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe("tenant storefront order orchestration", () => {
  it("recovers one transient storefront bootstrap without showing a terminal error", async () => {
    const loadStorefront = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("temporary", "network"))
      .mockResolvedValueOnce(storefront(10));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(null) },
      orders: { loadStorefront },
    });

    render(<UiAdaptersProvider adapters={adapters}><App /></UiAdaptersProvider>);

    expect(await screen.findByText("Live Server Store")).toBeTruthy();
    expect(loadStorefront).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("heading", { name: "تعذر تحميل المتجر" })).toBeNull();
  });

  it("retries a missing storefront in place after the customer requests it", async () => {
    const loadStorefront = vi.fn()
      .mockRejectedValueOnce(new UiAdapterError("missing", "not_found"))
      .mockResolvedValueOnce(storefront(10));
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(null) },
      orders: { loadStorefront },
    });
    const user = userEvent.setup();

    render(<UiAdaptersProvider adapters={adapters}><App /></UiAdaptersProvider>);

    expect(await screen.findByText(/لا يوجد متجر منشور لهذا العنوان/)).toBeTruthy();
    expect(loadStorefront).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByText("Live Server Store")).toBeTruthy();
    expect(loadStorefront).toHaveBeenCalledTimes(2);
  });

  it("bootstraps only on the tenant host and preserves cart edits during deferred stale-quote refresh", async () => {
    let resolveRefresh!: (value: ReturnType<typeof storefront>) => void;
    const refresh = new Promise<ReturnType<typeof storefront>>((resolve) => { resolveRefresh = resolve; });
    const loadStorefront = vi.fn()
      .mockResolvedValueOnce(storefront(10))
      .mockReturnValueOnce(refresh);
    const create = vi.fn().mockRejectedValueOnce(
      new UiAdapterError("The quote is stale.", "conflict", "order_quote_stale"),
    );
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(null) },
      orders: { loadStorefront, create },
    });
    const user = userEvent.setup();
    render(<UiAdaptersProvider adapters={adapters}><App /></UiAdaptersProvider>);

    expect(await screen.findByText("Live Server Store")).toBeTruthy();
    expect(loadStorefront).toHaveBeenCalledTimes(1);
    await user.click(screen.getAllByTitle("أضف للسلة")[0]);
    const cartButton = screen.getAllByRole("button").find((button) => button.textContent?.includes("السلة"));
    expect(cartButton).toBeTruthy();
    await user.click(cartButton!);
    await user.click(await screen.findByRole("button", { name: /إتمام الطلب وتعبئة البيانات/ }));
    await screen.findByRole("heading", { name: /إتمام الطلب/ });
    await user.type(screen.getByPlaceholderText(/عبدالله محمد/), "Stale Customer");
    await user.type(screen.getByPlaceholderText(/0500000000/), "+967700000010");
    await user.type(screen.getByPlaceholderText(/اسم الشارع/), "Stale Address");
    await user.click(screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" }));

    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadStorefront).toHaveBeenCalledTimes(2));
    const checkoutCartButton = screen.getAllByRole("button").find((button) => button.textContent?.includes("السلة"));
    await user.click(checkoutCartButton!);
    await user.click(await screen.findByRole("button", { name: "زيادة كمية Server Product" }));

    resolveRefresh(storefront(12.5));
    expect(await screen.findByText("12.5 YER")).toBeTruthy();
    const refreshedIncrease = screen.getByRole("button", { name: "زيادة كمية Server Product" });
    expect(refreshedIncrease.parentElement?.textContent).toContain("2");
    expect(await screen.findByText(/تم تحميل النسخة الأحدث/)).toBeTruthy();
  }, 20_000);
});
