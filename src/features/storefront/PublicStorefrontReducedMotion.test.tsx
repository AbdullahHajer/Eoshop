// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import StorePreview from "../../components/StorePreview";
import { ELEGANT_PRESET } from "../../types";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const product = {
  ...ELEGANT_PRESET.products[0],
  id: "22222222-2222-4222-8222-222222222222",
  name: "منتج اختبار تقليل الحركة",
  status: "published" as const,
};

function ReducedMotionHarness() {
  const [open, setOpen] = useState(false);
  return (
    <StorePreview
      config={{ ...ELEGANT_PRESET, products: [product], enableCashOnDelivery: true }}
      cart={[{ product, quantity: 1 }]}
      addToCart={vi.fn()}
      updateQuantity={vi.fn()}
      calculateTotal={vi.fn()}
      isCartDrawerOpen={open}
      setIsCartDrawerOpen={setOpen}
      hasOrdered={false}
      handleCheckout={vi.fn()}
      selectedCategory="الكل"
      setSelectedCategory={vi.fn()}
      externalPage="products"
      mode="live"
    />
  );
}

describe("public storefront reduced-motion boundary", () => {
  it("removes layout and drawer travel when reduced motion is requested", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const user = userEvent.setup();
    render(<ReducedMotionHarness />);

    const productCard = document.querySelector<HTMLElement>("[data-storefront-product-card]");
    expect(productCard?.getAttribute("data-reduced-motion")).toBe("true");

    await user.click(screen.getAllByRole("button", { name: /فتح سلة التسوق/ })[0]);
    const dialog = screen.getByRole("dialog", { name: /سلة التسوق/ });
    await waitFor(() => expect(dialog.style.transform).not.toContain("100%"));
  });
});
