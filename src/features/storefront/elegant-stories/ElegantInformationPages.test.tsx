// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ELEGANT_PRESET } from "../../../types";
import { ElegantAboutPage, ElegantContactPage } from "./ElegantInformationPages";

afterEach(cleanup);

const theme = {
  primaryColor: "#7c3f2d",
  secondaryColor: "#1c1917",
  textColor: "#57534e",
  backgroundColor: "#fbfaf7",
  cardBackground: "#ffffff",
  borderColor: "#e8e4de",
};

describe("Elegant information pages", () => {
  it("renders only the saved merchant story and real actions", async () => {
    const user = userEvent.setup();
    const onOpenProducts = vi.fn();
    const onOpenContact = vi.fn();
    render(
      <ElegantAboutPage
        config={{
          ...ELEGANT_PRESET,
          aboutTitle: "حكاية فيلور",
          aboutText: "نبذة محفوظة من المتجر.",
          aboutVision: "رؤية محفوظة من المتجر.",
          aboutImage: "https://images.example.test/about.jpg",
          address: "عنوان المتجر المنشور",
          workingHours: "09:00–17:00",
        }}
        {...theme}
        onOpenProducts={onOpenProducts}
        onOpenContact={onOpenContact}
      />,
    );

    expect(screen.getByRole("heading", { name: "حكاية فيلور" })).toBeTruthy();
    expect(screen.getByText("نبذة محفوظة من المتجر.")).toBeTruthy();
    expect(screen.getByText("رؤية محفوظة من المتجر.")).toBeTruthy();
    expect(screen.getByAltText(/صورة تعريفية لمتجر/).getAttribute("src")).toBe("https://images.example.test/about.jpg");
    await user.click(screen.getByRole("button", { name: "تصفّح المجموعة" }));
    await user.click(screen.getByRole("button", { name: "تواصل معنا" }));
    expect(onOpenProducts).toHaveBeenCalledTimes(1);
    expect(onOpenContact).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/ضمان رسمي|شحن فوري|أقل من 24/)).toBeNull();
  });

  it("publishes only valid contact and social destinations", () => {
    render(
      <ElegantContactPage
        config={{
          ...ELEGANT_PRESET,
          phone: "+967700000001",
          whatsapp: "+967700000002",
          email: "merchant@example.test",
          instagram: "@merchant_store",
          twitter: "not a valid handle",
          tiktok: "",
          snapchat: "",
          address: "عنوان منشور",
          workingHours: "السبت–الخميس",
        }}
        {...theme}
      />,
    );

    expect(screen.getByRole("link", { name: /967700000001/ }).getAttribute("href")).toBe("tel:+967700000001");
    expect(screen.getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toBe("https://wa.me/967700000002");
    expect(screen.getByRole("link", { name: /merchant@example.test/ }).getAttribute("href")).toBe("mailto:merchant@example.test");
    expect(screen.getByRole("link", { name: "فتح Instagram" }).getAttribute("href")).toBe("https://instagram.com/merchant_store");
    expect(screen.queryByRole("link", { name: "فتح X" })).toBeNull();
    expect(document.querySelector('a[href="#"]')).toBeNull();
  });

  it("uses explicit empty states instead of invented contact data", () => {
    render(
      <ElegantContactPage
        config={{ ...ELEGANT_PRESET, phone: "", whatsapp: "", email: "", address: "", workingHours: "", instagram: "", twitter: "", tiktok: "", snapchat: "" }}
        {...theme}
      />,
    );

    expect(screen.getByRole("heading", { name: "لا توجد وسيلة تواصل منشورة" })).toBeTruthy();
    expect(screen.getByText("لم يضف المتجر وسيلة تواصل مباشرة بعد.")).toBeTruthy();
    expect(screen.getByText("لا توجد حسابات اجتماعية منشورة.")).toBeTruthy();
    expect(screen.queryByText(/support@store|الرياض|أقل من 24/)).toBeNull();
  });
});
