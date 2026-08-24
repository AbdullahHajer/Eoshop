// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import StorefrontHome from "./StorefrontHome";

afterEach(cleanup);

describe("StorefrontHome", () => {
  it("renders the server-owned order exactly and hides disabled sections", () => {
    const onSelectCategory = vi.fn();
    const config = {
      ...ELEGANT_PRESET,
      products: [{ ...ELEGANT_PRESET.products[0], status: "published" as const }],
      homeSections: [
        { id: "featured_products" as const, visible: true },
        { id: "hero" as const, visible: false },
        { id: "categories" as const, visible: true },
        { id: "trust" as const, visible: true },
        { id: "about" as const, visible: true },
      ],
      phone: "",
      whatsapp: "",
      email: "",
      workingHours: "",
      enableCashOnDelivery: false,
      enableBankTransfer: false,
      enableEWallets: false,
      shippingFee: undefined,
      freeShippingThreshold: undefined,
    };
    const view = render(<StorefrontHome config={config} isElegant primaryColor="#112233" secondaryColor="#334455" onOpenProducts={vi.fn()} onOpenAbout={vi.fn()} onSelectCategory={onSelectCategory} onOpenProduct={vi.fn()} onAddProduct={vi.fn()} />);

    expect(Array.from(view.container.querySelectorAll("[data-storefront-section]")).map((node) => node.getAttribute("data-storefront-section"))).toEqual([
      "featured_products", "categories", "trust", "about",
    ]);
    expect(view.container.querySelector('[data-storefront-section="hero"]')).toBeNull();
    expect(screen.queryByText(/ضمان رسمي|تقييم مشتري|شحن فوري/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: config.products[0].category }));
    expect(onSelectCategory).toHaveBeenCalledWith(config.products[0].category);
  });

  it("shows truthful empty states without inventing catalog or service claims", () => {
    render(<StorefrontHome config={{ ...ELEGANT_PRESET, products: [], phone: "", whatsapp: "", email: "", workingHours: "", enableCashOnDelivery: false, enableBankTransfer: false, enableEWallets: false, shippingFee: undefined, freeShippingThreshold: undefined }} isElegant={false} primaryColor="#112233" secondaryColor="#334455" onOpenProducts={vi.fn()} onOpenAbout={vi.fn()} onSelectCategory={vi.fn()} onOpenProduct={vi.fn()} onAddProduct={vi.fn()} />);
    expect(screen.getByText("لم يضف المتجر معلومات الخدمة بعد")).toBeTruthy();
    expect(screen.getByText("لا توجد تصنيفات منشورة بعد.")).toBeTruthy();
    expect(screen.getByText("لم ينشر المتجر منتجات بعد.")).toBeTruthy();
  });

  it.each([
    { isElegant: true, label: "elegant" },
    { isElegant: false, label: "tech" },
  ])("uses the image-layer switch as the only source of hero contrast in $label", ({ isElegant }) => {
    const heroConfig = {
      ...ELEGANT_PRESET,
      showHeroBanner: false,
      heroBannerImage: "https://cdn.example.test/hero.jpg",
      heroBannerTitle: "Readable hero",
    };
    const props = {
      config: heroConfig,
      isElegant,
      primaryColor: "#112233",
      secondaryColor: "#334455",
      onOpenProducts: vi.fn(),
      onOpenAbout: vi.fn(),
      onSelectCategory: vi.fn(),
      onOpenProduct: vi.fn(),
      onAddProduct: vi.fn(),
    };
    const view = render(<StorefrontHome {...props} />);

    expect(view.container.querySelector('img[src="https://cdn.example.test/hero.jpg"]')).toBeNull();
    const subtitle = screen.getByText(heroConfig.heroBannerSubtitle || heroConfig.slogan);
    expect(subtitle.className).toContain(isElegant ? "text-slate-600" : "text-white/85");
    if (isElegant) expect(screen.getByRole("heading", { name: "Readable hero" }).style.color).not.toBe("");

    view.rerender(<StorefrontHome {...props} config={{ ...heroConfig, showHeroBanner: true }} />);
    expect(view.container.querySelector('img[src="https://cdn.example.test/hero.jpg"]')).not.toBeNull();
    expect(screen.getByText(heroConfig.heroBannerSubtitle || heroConfig.slogan).className).toContain("text-white/85");
    if (isElegant) expect(screen.getByRole("heading", { name: "Readable hero" }).style.color).toBe("");
  });
});
