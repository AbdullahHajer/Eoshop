// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderReceipt } from "../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../types";
import StorePreview from "./StorePreview";

const product = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Server Product",
  price: 10,
  description: "Server product",
  category: "General",
  imageKeyword: "product",
  status: "published" as const,
};

const receipt: OrderReceipt = {
  id: "22222222-2222-4222-8222-222222222222",
  number: "EO-SERVER-001",
  status: "submitted",
  paymentState: "transfer_submitted_unverified",
  currencyCode: "YER",
  totals: {
    itemsSubtotalMinor: 1250,
    discountMinor: 0,
    shippingMinor: 500,
    taxMinor: 188,
    paymentFeeMinor: 100,
    grandTotalMinor: 2038,
  },
  items: [{
    productId: product.id,
    name: "Server Product",
    sku: "SERVER-1",
    unitPriceMinor: 1250,
    quantity: 1,
    lineTotalMinor: 1250,
    tracked: true,
  }],
  createdAt: "2026-08-17T10:00:00Z",
};

afterEach(cleanup);

function checkoutProps() {
  return {
    config: {
      ...ELEGANT_PRESET,
      products: [product],
      currency: "YER",
      requireEmail: false,
      enableCashOnDelivery: false,
      enableEWallets: false,
      enableBankTransfer: true,
      bankName: "Server Bank",
      bankAccountName: "Server Merchant",
      bankAccountNumber: "123456789012",
    },
    cart: [{ product, quantity: 1 }],
    addToCart: vi.fn(),
    updateQuantity: vi.fn(),
    calculateTotal: vi.fn(),
    isCartDrawerOpen: false,
    setIsCartDrawerOpen: vi.fn(),
    hasOrdered: false,
    handleCheckout: vi.fn(),
    selectedCategory: "all",
    setSelectedCategory: vi.fn(),
    externalPage: "checkout",
  };
}

async function fillRequiredCheckoutFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText(/عبدالله محمد/), "Live Customer");
  await user.type(screen.getByPlaceholderText(/0500000000/), "+967700000009");
  await user.type(screen.getByPlaceholderText(/اسم الشارع/), "Server Address");
}

describe("server-backed checkout interface", () => {
  it("submits bank transfer once and renders the server receipt instead of browser totals", async () => {
    let resolveOrder!: (value: OrderReceipt) => void;
    const pending = new Promise<OrderReceipt>((resolve) => { resolveOrder = resolve; });
    const submitOrder = vi.fn().mockReturnValue(pending);
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} mode="live" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.click(screen.getByText("الدفع عبر المحافظ الإلكترونية"));
    const submit = screen.getByRole("button", { name: "تأكيد الطلب بالسعر الخادمي" });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => expect(submitOrder).toHaveBeenCalledTimes(1));
    expect(submitOrder.mock.calls[0][0].payment).toEqual({ method: "bank_transfer", reference: undefined });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    resolveOrder(receipt);
    expect(await screen.findByText("EO-SERVER-001")).toBeTruthy();
    expect(screen.getByText("20.38 YER")).toBeTruthy();
    expect(props.handleCheckout).toHaveBeenCalledTimes(1);
  });

  it("keeps preview checkout non-persistent", async () => {
    const submitOrder = vi.fn();
    const props = checkoutProps();
    const user = userEvent.setup();
    render(<StorePreview {...props} mode="preview" submitOrder={submitOrder} />);

    await fillRequiredCheckoutFields(user);
    await user.click(screen.getByRole("button", { name: "معاينة إرسال الطلب" }));

    await waitFor(() => expect(screen.getByText(/PREVIEW-/)).toBeTruthy());
    expect(submitOrder).not.toHaveBeenCalled();
  });
});
