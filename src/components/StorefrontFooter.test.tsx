// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../types";
import StorefrontFooter from "./StorefrontFooter";

afterEach(cleanup);

describe("StorefrontFooter", () => {
  it("exposes only working merchant links and real navigation actions", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <StorefrontFooter
        config={{
          ...ELEGANT_PRESET,
          phone: "+967700000001",
          whatsapp: "+967700000002",
          email: "merchant@example.test",
          instagram: "@merchant_store",
          twitter: "not a valid handle",
          tiktok: "",
          snapchat: "",
        }}
        primaryColor="#7c3f12"
        secondaryColor="#1c1917"
        cardBackground="#ffffff"
        borderColor="#e7e5e4"
        attribution="Built on Eoshop"
        onNavigate={onNavigate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "المنتجات" }));
    expect(onNavigate).toHaveBeenCalledWith("products");
    expect(screen.getByRole("link", { name: /967700000001/ }).getAttribute("href")).toBe("tel:+967700000001");
    expect(screen.getByRole("link", { name: "WhatsApp" }).getAttribute("href")).toBe("https://wa.me/967700000002");
    expect(screen.getByRole("link", { name: /merchant@example.test/ }).getAttribute("href")).toBe("mailto:merchant@example.test");
    expect(screen.getByRole("link", { name: "فتح Instagram" }).getAttribute("href")).toBe("https://instagram.com/merchant_store");
    expect(screen.queryByRole("link", { name: "فتح X" })).toBeNull();
    expect(screen.getByText("Built on Eoshop")).toBeTruthy();
  });

  it("renders truthful empty contact states without placeholder destinations", () => {
    render(
      <StorefrontFooter
        config={{ ...ELEGANT_PRESET, phone: "", whatsapp: "", email: "", address: "", workingHours: "", instagram: "", twitter: "", tiktok: "", snapchat: "" }}
        primaryColor="#7c3f12"
        secondaryColor="#1c1917"
        cardBackground="#ffffff"
        borderColor="#e7e5e4"
        onNavigate={vi.fn()}
      />,
    );

    expect(screen.getByText("لم يضف المتجر بيانات تواصل بعد.")).toBeTruthy();
    expect(screen.getByText("لا توجد حسابات اجتماعية منشورة.")).toBeTruthy();
    expect(document.querySelector('a[href="#"]')).toBeNull();
  });
});
