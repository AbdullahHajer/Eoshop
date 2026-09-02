// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET, TECH_PRESET } from "../../types";
import StorefrontHeaderDispatcher from "./StorefrontHeaderDispatcher";

afterEach(cleanup);

const tokens = {
  surface: "#FFFFFF",
  ink: "#0F172A",
  mutedInk: "#475569",
  border: "#E2E8F0",
  accent: "#0969F0",
};

function renderHeader(theme: "tech" | "elegant") {
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
        config={{ ...config, themeStyle: theme }}
        isElegant={theme === "elegant"}
        categories={["الكل", "إلكترونيات"]}
        cartCount={2}
        cartTotal={2500}
        searchQuery=""
        currentRoute="home"
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

    fireEvent.click(screen.getByRole("button", { name: "الأجهزة" }));
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
});
