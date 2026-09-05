// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET, TECH_PRESET, type StoreConfig } from "../../types";
import StorefrontHeaderDispatcher from "./StorefrontHeaderDispatcher";
import type { StorefrontHeaderRoute } from "./tech-bento/TechStorefrontHeader";

afterEach(cleanup);

const tokens = {
  surface: "#FFFFFF",
  ink: "#0F172A",
  mutedInk: "#475569",
  border: "#E2E8F0",
  accent: "#0969F0",
};

function renderHeader(
  theme: "tech" | "elegant",
  configOverrides: Partial<StoreConfig> = {},
  currentRoute: StorefrontHeaderRoute = "home",
) {
  const callbacks = {
    onSearchChange: vi.fn(),
    onSearchSubmit: vi.fn(),
    onOpenHome: vi.fn(),
    onOpenProducts: vi.fn(),
    onOpenAbout: vi.fn(),
    onOpenContact: vi.fn(),
    onOpenCart: vi.fn(),
    onSelectCategory: vi.fn(),
  };
  const config = theme === "tech" ? TECH_PRESET : ELEGANT_PRESET;
  return {
    ...render(
      <StorefrontHeaderDispatcher
        config={{ ...config, ...configOverrides, themeStyle: theme }}
        isElegant={theme === "elegant"}
        categories={["الكل", "إلكترونيات"]}
        cartCount={2}
        cartTotal={2500}
        searchQuery=""
        currentRoute={currentRoute}
        phone="+967700000001"
        tokens={tokens}
        {...callbacks}
      />,
    ),
    callbacks,
  };
}

describe("StorefrontHeaderDispatcher", () => {
  it("routes Tech search, navigation and cart actions through shared handlers", () => {
    const { container, callbacks } = renderHeader("tech");
    expect(container.querySelector("[data-tech-storefront-header]")).not.toBeNull();
    expect(container.querySelector("[data-elegant-editorial-header]")).toBeNull();

    const search = screen.getByRole("searchbox", { name: "البحث في منتجات المتجر" });
    fireEvent.change(search, { target: { value: "سماعة" } });
    expect(callbacks.onSearchChange).toHaveBeenCalledWith("سماعة");
    fireEvent.submit(search.closest("form") as HTMLFormElement);
    expect(callbacks.onSearchSubmit).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "المنتجات" }));
    expect(callbacks.onOpenProducts).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole("button", { name: /فتح سلة التسوق/ })[0]);
    expect(callbacks.onOpenCart).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing Elegant header and its category handler intact", () => {
    const { container, callbacks } = renderHeader("elegant");
    expect(container.querySelector("[data-elegant-editorial-header]")).not.toBeNull();
    expect(container.querySelector("[data-tech-storefront-header]")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: "إلكترونيات" })[0]);
    expect(callbacks.onSelectCategory).toHaveBeenCalledWith("إلكترونيات");
  });

  it("uses the configured Elegant icon and bounded logo size without leaking an unused image", () => {
    const { container } = renderHeader("elegant", {
      logoType: "icon",
      logoIcon: "◈",
      logoUrl: "https://cdn.example.test/unused-logo.webp",
      logoSize: 999,
    });

    const header = container.querySelector<HTMLElement>("[data-elegant-editorial-header]");
    expect(header?.style.getPropertyValue("--elegant-logo-size")).toBe("120px");
    expect(container.querySelector('[data-storefront-brand-logo="image"]')).toBeNull();
    expect(container.querySelector('[data-storefront-brand-logo="icon"]')?.textContent).toBe("◈");
  });

  it("uses the configured Elegant image logo and preserves its privacy boundary", () => {
    const { container } = renderHeader("elegant", {
      logoType: "image",
      logoIcon: "◈",
      logoUrl: "https://cdn.example.test/store-logo.webp",
      logoSize: 64,
    });

    const logo = container.querySelector<HTMLImageElement>('[data-storefront-brand-logo="image"]');
    expect(logo?.getAttribute("src")).toBe("https://cdn.example.test/store-logo.webp");
    expect(logo?.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(container.querySelector<HTMLElement>("[data-elegant-editorial-header]")?.style.getPropertyValue("--elegant-logo-size")).toBe("64px");
  });

  it("routes Elegant contact navigation and marks it current on desktop and mobile", () => {
    const { callbacks } = renderHeader("elegant", {}, "contact");
    const contactItems = screen.getAllByRole("button", { name: "تواصل معنا" });
    expect(contactItems).toHaveLength(2);
    expect(contactItems.every((item) => item.getAttribute("aria-current") === "page")).toBe(true);
    fireEvent.click(contactItems[0]);
    expect(callbacks.onOpenContact).toHaveBeenCalledTimes(1);
  });

  it.each(["product", "checkout"] as const)("does not mark Elegant home current on the %s route", (route) => {
    const { container } = renderHeader("elegant", {}, route);
    const homeItems = container.querySelectorAll('[data-storefront-nav="home"]');
    expect(homeItems).toHaveLength(2);
    expect(Array.from(homeItems).every((item) => item.getAttribute("aria-current") === null)).toBe(true);
  });

  it("uses category-neutral Tech navigation and fallback identity", () => {
    renderHeader("tech", { storeName: "" });
    expect(screen.getByRole("button", { name: "المنتجات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "العودة إلى الصفحة الرئيسية لمتجر متجر إلكتروني" })).toBeTruthy();
    expect(screen.queryByText("الأجهزة")).toBeNull();
  });
});
