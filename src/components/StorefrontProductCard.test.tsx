// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import StorefrontProductCard from "./StorefrontProductCard";

afterEach(cleanup);

const baseProps = {
  currency: "ر.س",
  primaryColor: "#7c3f12",
  secondaryColor: "#1c1917",
  cardBackground: "#ffffff",
  borderColor: "#e7e5e4",
};

describe("StorefrontProductCard", () => {
  it("uses real open and add actions for a purchasable product", async () => {
    const user = userEvent.setup();
    const product = { ...ELEGANT_PRESET.products[0], status: "published" as const, manageStock: true, stockQuantity: 3 };
    const onOpen = vi.fn();
    const onAdd = vi.fn();
    render(<StorefrontProductCard {...baseProps} product={product} onOpen={onOpen} onAdd={onAdd} />);

    await user.click(screen.getByRole("button", { name: new RegExp(`^فتح تفاصيل ${product.name}$`) }));
    expect(onOpen).toHaveBeenCalledWith(product);
    await user.click(screen.getByRole("button", { name: new RegExp(`إضافة ${product.name}`) }));
    expect(onAdd).toHaveBeenCalledWith(product);
  });

  it("prevents adding a product with no available stock", () => {
    const product = { ...ELEGANT_PRESET.products[0], status: "published" as const, manageStock: true, stockQuantity: 0 };
    render(<StorefrontProductCard {...baseProps} product={product} onOpen={vi.fn()} onAdd={vi.fn()} />);

    expect(screen.getByRole("button", { name: new RegExp(`إضافة ${product.name}`) }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("غير متوفر حاليًا")).toBeTruthy();
  });
});
