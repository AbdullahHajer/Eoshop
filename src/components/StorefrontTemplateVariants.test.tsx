// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET, TECH_PRESET, type StoreConfig } from "../types";
import StorefrontFooter from "./StorefrontFooter";
import StorefrontHome from "./StorefrontHome";
import StorefrontProductDetail from "./StorefrontProductDetail";

afterEach(cleanup);

const products = [
  { ...ELEGANT_PRESET.products[0], id: "template-product-1", status: "published" as const },
  { ...ELEGANT_PRESET.products[1], id: "template-product-2", status: "published" as const },
];

const sharedConfig: StoreConfig = {
  ...ELEGANT_PRESET,
  products,
  homeSections: [
    { id: "trust", visible: true },
    { id: "categories", visible: true },
    { id: "featured_products", visible: true },
    { id: "about", visible: true },
  ],
};

const homeCallbacks = {
  onOpenProducts: vi.fn(),
  onOpenAbout: vi.fn(),
  onSelectCategory: vi.fn(),
  onOpenProduct: vi.fn(),
  onAddProduct: vi.fn(),
};

describe("storefront template presentation strategies", () => {
  it("renders an editorial flow for Elegant and a spanning Bento grid for Tech", () => {
    const view = render(
      <StorefrontHome config={sharedConfig} isElegant primaryColor="#7C3F12" secondaryColor="#1C1917" {...homeCallbacks} />,
    );

    const elegant = view.container.querySelector<HTMLElement>('[data-storefront-home-template="elegant-editorial"]');
    expect(elegant?.className).toContain("flex");
    expect(view.container.querySelector('[data-storefront-product-template="elegant-editorial"]')).not.toBeNull();
    expect(view.container.querySelector("[data-storefront-bento-product]")).toBeNull();

    view.rerender(
      <StorefrontHome config={{ ...sharedConfig, ...TECH_PRESET, products, homeSections: sharedConfig.homeSections }} isElegant={false} primaryColor="#0369A1" secondaryColor="#0F172A" {...homeCallbacks} />,
    );

    const tech = view.container.querySelector<HTMLElement>('[data-storefront-home-template="tech-bento"]');
    expect(tech?.className).toContain("md:grid-cols-12");
    const featured = view.container.querySelector<HTMLElement>('[data-storefront-bento-product="featured"]');
    expect(featured?.className).toContain("col-span-2");
    expect(view.container.querySelector('[data-storefront-product-template="tech-bento"]')).not.toBeNull();
  });

  it.each([
    { themeStyle: "elegant" as const, isElegant: true },
    { themeStyle: "tech" as const, isElegant: false },
  ])("keeps category, product and cart actions live in $themeStyle", ({ themeStyle, isElegant }) => {
    const onSelectCategory = vi.fn();
    const onOpenProduct = vi.fn();
    const onAddProduct = vi.fn();
    render(
      <StorefrontHome
        config={{ ...sharedConfig, themeStyle }}
        isElegant={isElegant}
        primaryColor="#0369A1"
        secondaryColor="#0F172A"
        {...homeCallbacks}
        onSelectCategory={onSelectCategory}
        onOpenProduct={onOpenProduct}
        onAddProduct={onAddProduct}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: products[0].category }));
    expect(onSelectCategory).toHaveBeenCalledWith(products[0].category);
    fireEvent.click(screen.getAllByRole("button", { name: `فتح تفاصيل ${products[0].name}` })[0]);
    expect(onOpenProduct).toHaveBeenCalledWith(products[0]);
    fireEvent.click(screen.getAllByRole("button", { name: `إضافة ${products[0].name} إلى السلة` })[0]);
    expect(onAddProduct).toHaveBeenCalledWith(products[0]);
  });

  it("applies distinct shared-component variants without forking their contracts", () => {
    const footer = render(
      <StorefrontFooter config={sharedConfig} primaryColor="#7C3F12" secondaryColor="#1C1917" cardBackground="#FFFFFF" borderColor="#E7E5E4" onNavigate={vi.fn()} />,
    );
    expect(footer.container.querySelector('[data-storefront-footer-template="elegant-editorial"]')).not.toBeNull();
    footer.rerender(
      <StorefrontFooter config={{ ...sharedConfig, themeStyle: "tech" }} primaryColor="#0369A1" secondaryColor="#0F172A" cardBackground="#FFFFFF" borderColor="#E2E8F0" onNavigate={vi.fn()} />,
    );
    expect(footer.container.querySelector('[data-storefront-footer-template="tech-bento"] nav')?.className).toContain("rounded-2xl");

    footer.rerender(
      <StorefrontProductDetail product={products[0]} config={sharedConfig} primaryColor="#7C3F12" secondaryColor="#1C1917" onBack={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(footer.container.querySelector('[data-storefront-product-detail-template="elegant-editorial"] .aspect-\\[4\\/5\\]')).not.toBeNull();
    footer.rerender(
      <StorefrontProductDetail product={products[0]} config={{ ...sharedConfig, themeStyle: "tech" }} primaryColor="#0369A1" secondaryColor="#0F172A" onBack={vi.fn()} onAdd={vi.fn()} />,
    );
    expect(footer.container.querySelector('[data-storefront-product-detail-template="tech-bento"] .md\\:col-span-7')).not.toBeNull();
  });
});
